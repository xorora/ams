import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, deviceTerminals, employees } from "@/db/schema";
import { findEmployeeForZktimeImport, findEmployeeByCodeVariants } from "@/lib/admin/employee-identity";
import { ZktimeClient } from "@/lib/zktime/client";
import {
  emailDomainForCompanySlug,
  loadActiveCompanies,
  parseZktimeDepartmentLabel,
  resolveCompanyFromDepartmentLabel,
} from "@/lib/zktime/company-from-department";
import { getDefaultCompanySlug } from "@/lib/zktime/config";
import {
  buildDepartmentIdMap,
  pushAllOrganizationalDataToZktime,
  pushMasterDataToZktime,
} from "@/lib/zktime/organizational-push";
import {
  employeeNeedsPushToZktime,
  filterEmployeesNeedingPush,
  findZktimeEmployeeByCode,
} from "@/lib/zktime/push-diff";
import {
  getSyncStateValue,
  setSyncStateValue,
  ZKTIME_LAST_ATTENDANCE_NEXT_SINCE,
  ZKTIME_LAST_EMPLOYEE_PUSH_AT,
  ZKTIME_LAST_EMPLOYEE_SYNC_AT,
  ZKTIME_LAST_TERMINAL_SYNC_AT,
} from "@/lib/zktime/sync-state";
import type {
  ZktimeEmployeeSyncResultItem,
  ZktimeEmployeeUpsertRequest,
  ZktimeTerminal,
} from "@/lib/zktime/types";
import { normalizeMasterDataSyncResponse } from "@/lib/zktime/types";

function normalizeDepartmentKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function resolveDefaultCompanyId(activeCompanies: Awaited<ReturnType<typeof loadActiveCompanies>>): Promise<string | null> {
  const company = activeCompanies.find((item) => item.slug === getDefaultCompanySlug());
  return company?.id ?? activeCompanies[0]?.id ?? null;
}

export type EmployeePullSummary = {
  emp_code: string;
  full_name: string;
  department: string | null;
  status: number | null | undefined;
};

export type EmployeePullResult = {
  fetched: number;
  updated: number;
  created: number;
  employees: EmployeePullSummary[];
};

export async function pullEmployeesFromZktime(client: ZktimeClient): Promise<EmployeePullResult> {
  const zktimeEmployees = await client.getEmployees();
  const activeCompanies = await loadActiveCompanies();
  const defaultCompanyId = await resolveDefaultCompanyId(activeCompanies);

  if (!defaultCompanyId) {
    throw new Error(`Default company not found: ${getDefaultCompanySlug()}`);
  }

  let updated = 0;
  let created = 0;
  const employeeSummaries: EmployeePullSummary[] = [];

  for (const zktimeEmp of zktimeEmployees) {
    const empCode = zktimeEmp.emp_code.trim();
    const fullName = zktimeEmp.full_name.trim();
    const zktimeDepartmentLabel = zktimeEmp.department?.dept_name?.trim() || null;
    const { department } = parseZktimeDepartmentLabel(zktimeDepartmentLabel);
    const resolvedCompany = resolveCompanyFromDepartmentLabel(
      zktimeDepartmentLabel,
      activeCompanies,
      defaultCompanyId,
    );
    const companyId = resolvedCompany.id;

    employeeSummaries.push({
      emp_code: empCode,
      full_name: fullName || empCode,
      department: department ?? zktimeDepartmentLabel,
      status: zktimeEmp.app_status,
    });

    if (
      zktimeEmp.app_status !== undefined &&
      zktimeEmp.app_status !== 0 &&
      zktimeEmp.app_status !== 1
    ) {
      continue;
    }

    const existing = await findEmployeeForZktimeImport({
      empCode,
      fullName: fullName || empCode,
      companyId,
    });

    if (existing) {
      const resolvedName = fullName || existing.fullName;
      const updates: Partial<typeof employees.$inferInsert> = {
        updatedAt: new Date(),
      };

      if (existing.companyId !== companyId) {
        updates.companyId = companyId;
      }
      if (existing.fullName !== resolvedName) {
        updates.fullName = resolvedName;
      }
      if (department && existing.department !== department) {
        updates.department = department;
      } else if (
        zktimeDepartmentLabel &&
        !department &&
        existing.department !== zktimeDepartmentLabel
      ) {
        updates.department = zktimeDepartmentLabel;
      }
      if (existing.employeeCode !== empCode) {
        const codeOwner = await findEmployeeByCodeVariants(empCode);
        if (!codeOwner || codeOwner.id === existing.id) {
          updates.employeeCode = empCode;
        }
      }

      if (Object.keys(updates).length > 1) {
        await db.update(employees).set(updates).where(eq(employees.id, existing.id));
        updated += 1;
      }
      continue;
    }

    const domain = emailDomainForCompanySlug(resolvedCompany.slug);
    const localPart = normalizeName(fullName) || empCode;
    const email = `${localPart}@${domain}`.toLowerCase();

    const [emailConflict] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.email, email))
      .limit(1);

    const resolvedEmail = emailConflict
      ? `${localPart}.${empCode}@${domain}`.toLowerCase()
      : email;

    await db.insert(employees).values({
      employeeCode: empCode,
      fullName: fullName || empCode,
      email: resolvedEmail,
      companyId,
      department: department ?? zktimeDepartmentLabel,
    });
    created += 1;
  }

  await setSyncStateValue(ZKTIME_LAST_EMPLOYEE_SYNC_AT, new Date().toISOString());

  return { fetched: zktimeEmployees.length, updated, created, employees: employeeSummaries };
}

export type EmployeePushResult = {
  pushed: number;
  queued: number;
  queuedForDevice: number;
  skippedUnchanged: number;
  failures: Array<{ emp_code: string; message: string }>;
  employees: ZktimeEmployeeSyncResultItem[];
};

export async function pushEmployeesToZktime(
  client: ZktimeClient,
  payload: {
    departments?: Array<{ id: number; name: string }>;
    employees: ZktimeEmployeeUpsertRequest[];
    queue_to_device?: boolean;
    forceFull?: boolean;
  },
): Promise<EmployeePushResult> {
  if (payload.employees.length === 0) {
    return {
      pushed: 0,
      queued: 0,
      queuedForDevice: 0,
      skippedUnchanged: 0,
      failures: [],
      employees: [],
    };
  }

  let employeesToPush = payload.employees;
  let locallySkipped = 0;

  if (!payload.forceFull) {
    const zktimeEmployees = await client.getEmployees();
    const filtered = filterEmployeesNeedingPush(payload.employees, zktimeEmployees);
    employeesToPush = filtered.employeesToPush;
    locallySkipped = filtered.skippedUnchanged;
  }

  if (employeesToPush.length === 0) {
    return {
      pushed: 0,
      queued: 0,
      queuedForDevice: 0,
      skippedUnchanged: locallySkipped,
      failures: [],
      employees: [],
    };
  }

  const result = await pushMasterDataToZktime(client, {
    departments: payload.departments,
    employees: employeesToPush,
    queue_to_device: payload.queue_to_device,
  });
  const normalized = normalizeMasterDataSyncResponse(result);

  const pushed =
    normalized.employeesSynced > 0
      ? normalized.employeesSynced
      : employeesToPush.length - normalized.failures.length;

  return {
    pushed,
    queued: normalized.queuedForDevice,
    queuedForDevice: normalized.queuedForDevice,
    skippedUnchanged: locallySkipped + normalized.skippedUnchanged,
    failures: normalized.failures,
    employees: normalized.employees,
  };
}

export async function pushActiveEmployeesToZktime(
  client: ZktimeClient,
): Promise<EmployeePushResult> {
  const result = await pushAllOrganizationalDataToZktime(client);
  return {
    pushed: result.employeesPushed,
    queued: result.deviceSyncQueued,
    queuedForDevice: result.deviceSyncQueued,
    skippedUnchanged: result.skippedUnchanged,
    failures: result.failures,
    employees: result.employees,
  };
}

export async function pushEmployeeById(employeeId: string): Promise<void> {
  const client = ZktimeClient.tryFromEnv();
  if (!client) {
    return;
  }

  const row = await db
    .select({
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      department: employees.department,
      isActive: employees.isActive,
      companyName: companies.name,
    })
    .from(employees)
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(eq(employees.id, employeeId))
    .limit(1);

  const employee = row[0];
  if (!employee?.isActive) {
    return;
  }

  const zktimeDepartments = await client.getAllDepartments();
  const label = `${employee.companyName.trim()} - ${employee.department?.trim() || "General"}`;
  const departmentId =
    buildDepartmentIdMap(zktimeDepartments, [label]).get(normalizeDepartmentKey(label)) ?? 1;

  const departmentName = label.slice(0, 30);
  const bridgeEmployee = {
    emp_code: employee.employeeCode,
    full_name: employee.fullName,
    department_id: departmentId,
    department_name: departmentName,
    ams_department_id: departmentId,
  };

  const zktimeEmployees = await client.getEmployees();
  const existing = findZktimeEmployeeByCode(zktimeEmployees, employee.employeeCode);
  if (!employeeNeedsPushToZktime(bridgeEmployee, existing)) {
    return;
  }

  await pushEmployeesToZktime(client, {
    departments: [{ id: departmentId, name: departmentName }],
    employees: [bridgeEmployee],
  });
}

function resolveTerminalSerialNumber(terminal: ZktimeTerminal): string | null {
  for (const value of [terminal.sn, terminal.serial_number, terminal.terminal_sn, terminal.alias]) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const ip = terminal.ip_address?.trim();
  return ip || null;
}

function resolveTerminalLastSeenAt(terminal: ZktimeTerminal): Date | null {
  const raw = terminal.last_activity ?? terminal.last_seen_at;
  return raw ? new Date(raw) : null;
}

export async function syncTerminalsFromZktime(client: ZktimeClient): Promise<number> {
  const terminals = await client.getTerminals();
  const now = new Date();
  let synced = 0;

  for (const terminal of terminals) {
    const serialNumber = resolveTerminalSerialNumber(terminal);
    if (!serialNumber) {
      console.warn("[zktime] skipping terminal with no serial number, alias, or IP", terminal);
      continue;
    }

    const lastActivity = resolveTerminalLastSeenAt(terminal);
    const existing = await db.query.deviceTerminals.findFirst({
      where: eq(deviceTerminals.serialNumber, serialNumber),
    });

    if (existing) {
      await db
        .update(deviceTerminals)
        .set({
          alias: terminal.alias?.trim() || existing.alias,
          ipAddress: terminal.ip_address?.trim() || existing.ipAddress,
          firmwareVersion: terminal.firmware_version?.trim() || existing.firmwareVersion,
          lastSeenAt: lastActivity ?? existing.lastSeenAt,
          updatedAt: now,
        })
        .where(eq(deviceTerminals.id, existing.id));
      synced += 1;
      continue;
    }

    await db.insert(deviceTerminals).values({
      serialNumber,
      alias: terminal.alias?.trim() || null,
      ipAddress: terminal.ip_address?.trim() || null,
      firmwareVersion: terminal.firmware_version?.trim() || null,
      lastSeenAt: lastActivity,
    });
    synced += 1;
  }

  await setSyncStateValue(ZKTIME_LAST_TERMINAL_SYNC_AT, now.toISOString());
  return synced;
}

export async function listDevicesWithSyncState() {
  const devices = await db.select().from(deviceTerminals).orderBy(desc(deviceTerminals.lastSeenAt));

  const [lastAttendanceSync, lastEmployeeSync, lastTerminalSync, lastEmployeePush] =
    await Promise.all([
      getSyncStateValue(ZKTIME_LAST_ATTENDANCE_NEXT_SINCE),
      getSyncStateValue(ZKTIME_LAST_EMPLOYEE_SYNC_AT),
      getSyncStateValue(ZKTIME_LAST_TERMINAL_SYNC_AT),
      getSyncStateValue(ZKTIME_LAST_EMPLOYEE_PUSH_AT),
    ]);

  return {
    devices,
    syncState: {
      lastAttendanceSync,
      lastEmployeeSync,
      lastTerminalSync,
      lastEmployeePush,
    },
  };
}
