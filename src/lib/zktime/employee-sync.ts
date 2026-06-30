import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companies, deviceTerminals, employees, machinePunches } from "@/db/schema";
import { ZktimeClient } from "@/lib/zktime/client";
import { getDefaultCompanySlug } from "@/lib/zktime/config";
import {
  buildDepartmentIdMap,
  pushAllOrganizationalDataToZktime,
  pushMasterDataToZktime,
} from "@/lib/zktime/organizational-push";
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

function emailDomainForSlug(slug: string): string {
  if (slug === "crest-led") {
    return "crestled.com";
  }
  if (slug === "xorora") {
    return "xorora.com";
  }
  return `${slug.replace(/-/g, "")}.com`;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

async function resolveDefaultCompanyId(): Promise<string | null> {
  const company = await db.query.companies.findFirst({
    where: eq(companies.slug, getDefaultCompanySlug()),
  });
  return company?.id ?? null;
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
  const defaultCompanyId = await resolveDefaultCompanyId();

  if (!defaultCompanyId) {
    throw new Error(`Default company not found: ${getDefaultCompanySlug()}`);
  }

  let updated = 0;
  let created = 0;
  const employeeSummaries: EmployeePullSummary[] = [];

  for (const zktimeEmp of zktimeEmployees) {
    const fullName = zktimeEmp.full_name.trim();
    const department = zktimeEmp.department?.dept_name?.trim() || null;

    employeeSummaries.push({
      emp_code: zktimeEmp.emp_code,
      full_name: fullName || zktimeEmp.emp_code,
      department,
      status: zktimeEmp.app_status,
    });

    if (
      zktimeEmp.app_status !== undefined &&
      zktimeEmp.app_status !== 0 &&
      zktimeEmp.app_status !== 1
    ) {
      continue;
    }

    const existing = await db.query.employees.findFirst({
      where: eq(employees.employeeCode, zktimeEmp.emp_code),
    });

    if (existing) {
      const needsUpdate =
        existing.fullName !== fullName || (department && existing.department !== department);

      if (needsUpdate) {
        await db
          .update(employees)
          .set({
            fullName: fullName || existing.fullName,
            department: department ?? existing.department,
            updatedAt: new Date(),
          })
          .where(eq(employees.id, existing.id));
        updated += 1;
      }
      continue;
    }

    const slug = getDefaultCompanySlug();
    const domain = emailDomainForSlug(slug);
    const localPart = normalizeName(fullName) || zktimeEmp.emp_code;
    const email = `${localPart}@${domain}`.toLowerCase();

    const [emailConflict] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.email, email))
      .limit(1);

    const resolvedEmail = emailConflict
      ? `${localPart}.${zktimeEmp.emp_code}@${domain}`.toLowerCase()
      : email;

    await db.insert(employees).values({
      employeeCode: zktimeEmp.emp_code,
      fullName: fullName || zktimeEmp.emp_code,
      email: resolvedEmail,
      companyId: defaultCompanyId,
      department,
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

  const result = await pushMasterDataToZktime(client, payload);
  const normalized = normalizeMasterDataSyncResponse(result);

  const pushed =
    normalized.employeesSynced > 0
      ? normalized.employeesSynced
      : payload.employees.length - normalized.failures.length;

  return {
    pushed,
    queued: normalized.queuedForDevice,
    queuedForDevice: normalized.queuedForDevice,
    skippedUnchanged: normalized.skippedUnchanged,
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

  await pushEmployeesToZktime(client, {
    departments: [{ id: departmentId, name: departmentName }],
    employees: [
      {
        emp_code: employee.employeeCode,
        full_name: employee.fullName,
        department_id: departmentId,
        department_name: departmentName,
        ams_department_id: departmentId,
      },
    ],
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

export type UnmappedZktimePunch = {
  empCode: string;
  machineNo: string | null;
  machineEmpName: string | null;
  punchCount: number;
  lastPunchAt: Date;
};

export async function listUnmappedPunches(): Promise<UnmappedZktimePunch[]> {
  const punches = await db
    .select({
      cardNo: machinePunches.cardNo,
      machineNo: machinePunches.machineNo,
      machineEmpName: machinePunches.machineEmpName,
      punchAt: machinePunches.punchAt,
    })
    .from(machinePunches)
    .where(isNull(machinePunches.employeeId))
    .orderBy(desc(machinePunches.punchAt))
    .limit(1000);

  const grouped = new Map<string, UnmappedZktimePunch>();

  for (const punch of punches) {
    const key = `${punch.cardNo}|${punch.machineNo ?? ""}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        empCode: punch.cardNo,
        machineNo: punch.machineNo,
        machineEmpName: punch.machineEmpName,
        punchCount: 1,
        lastPunchAt: punch.punchAt,
      });
      continue;
    }

    existing.punchCount += 1;
    if (punch.punchAt > existing.lastPunchAt) {
      existing.lastPunchAt = punch.punchAt;
      if (punch.machineEmpName) {
        existing.machineEmpName = punch.machineEmpName;
      }
    }
  }

  return [...grouped.values()].sort(
    (left, right) => right.lastPunchAt.getTime() - left.lastPunchAt.getTime(),
  );
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
