import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companies, deviceTerminals, employees, machinePunches } from "@/db/schema";
import { ZktimeClient } from "@/lib/zktime/client";
import { getDefaultCompanySlug } from "@/lib/zktime/config";
import {
  buildDepartmentIdMap,
  pushAllOrganizationalDataToZktime,
} from "@/lib/zktime/organizational-push";
import {
  setSyncStateValue,
  ZKTIME_LAST_EMPLOYEE_PUSH_AT,
  ZKTIME_LAST_EMPLOYEE_SYNC_AT,
  ZKTIME_LAST_TERMINAL_SYNC_AT,
} from "@/lib/zktime/sync-state";
import type { ZktimeEmployeeUpsertRequest } from "@/lib/zktime/types";

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

export type EmployeePullResult = {
  fetched: number;
  updated: number;
  created: number;
};

export async function pullEmployeesFromZktime(client: ZktimeClient): Promise<EmployeePullResult> {
  const zktimeEmployees = await client.getEmployees();
  const defaultCompanyId = await resolveDefaultCompanyId();

  if (!defaultCompanyId) {
    throw new Error(`Default company not found: ${getDefaultCompanySlug()}`);
  }

  let updated = 0;
  let created = 0;

  for (const zktimeEmp of zktimeEmployees) {
    if (
      zktimeEmp.app_status !== undefined &&
      zktimeEmp.app_status !== 0 &&
      zktimeEmp.app_status !== 1
    ) {
      continue;
    }

    const fullName = zktimeEmp.full_name.trim();
    const department = zktimeEmp.department?.dept_name?.trim() || null;

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

  return { fetched: zktimeEmployees.length, updated, created };
}

export type EmployeePushResult = {
  pushed: number;
  queued: number;
  failures: Array<{ emp_code: string; message: string }>;
};

export async function pushEmployeesToZktime(
  client: ZktimeClient,
  payload: ZktimeEmployeeUpsertRequest[],
): Promise<EmployeePushResult> {
  if (payload.length === 0) {
    return { pushed: 0, queued: 0, failures: [] };
  }

  const failures: EmployeePushResult["failures"] = [];
  let pushed = 0;

  for (const employee of payload) {
    try {
      await client.upsertEmployee({
        emp_code: employee.emp_code,
        full_name: employee.full_name.trim().slice(0, 40),
        department_id: employee.department_id ?? 1,
      });
      pushed += 1;
    } catch (error) {
      failures.push({
        emp_code: employee.emp_code,
        message: error instanceof Error ? error.message : "Unknown push failure",
      });
    }
  }

  if (pushed > 0) {
    const syncResult = await client.syncEmployeesToDevice({
      emp_codes: payload
        .map((employee) => employee.emp_code)
        .filter((code) => !failures.some((failure) => failure.emp_code === code)),
    });

    await setSyncStateValue(ZKTIME_LAST_EMPLOYEE_PUSH_AT, new Date().toISOString());

    return {
      pushed,
      queued: syncResult.queued,
      failures,
    };
  }

  return { pushed: 0, queued: 0, failures };
}

export async function pushActiveEmployeesToZktime(
  client: ZktimeClient,
): Promise<EmployeePushResult> {
  const result = await pushAllOrganizationalDataToZktime(client);
  return {
    pushed: result.employeesPushed,
    queued: result.deviceSyncQueued,
    failures: result.failures,
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

  await pushEmployeesToZktime(client, [
    {
      emp_code: employee.employeeCode,
      full_name: employee.fullName,
      department_id: departmentId,
    },
  ]);
}

export async function syncTerminalsFromZktime(client: ZktimeClient): Promise<number> {
  const terminals = await client.getTerminals();
  const now = new Date();

  for (const terminal of terminals) {
    const lastActivity = terminal.last_seen_at ? new Date(terminal.last_seen_at) : null;
    const existing = await db.query.deviceTerminals.findFirst({
      where: eq(deviceTerminals.serialNumber, terminal.serial_number),
    });

    if (existing) {
      await db
        .update(deviceTerminals)
        .set({
          alias: terminal.alias || existing.alias,
          ipAddress: terminal.ip_address ?? existing.ipAddress,
          firmwareVersion: terminal.firmware_version ?? existing.firmwareVersion,
          lastSeenAt: lastActivity ?? existing.lastSeenAt,
          updatedAt: now,
        })
        .where(eq(deviceTerminals.id, existing.id));
      continue;
    }

    await db.insert(deviceTerminals).values({
      serialNumber: terminal.serial_number,
      alias: terminal.alias ?? null,
      ipAddress: terminal.ip_address ?? null,
      firmwareVersion: terminal.firmware_version ?? null,
      lastSeenAt: lastActivity,
    });
  }

  await setSyncStateValue(ZKTIME_LAST_TERMINAL_SYNC_AT, now.toISOString());
  return terminals.length;
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
  const { getSyncStateValue } = await import("@/lib/zktime/sync-state");
  const devices = await db.select().from(deviceTerminals).orderBy(desc(deviceTerminals.lastSeenAt));

  const [lastAttendanceSync, lastEmployeeSync, lastTerminalSync, lastEmployeePush] =
    await Promise.all([
      getSyncStateValue("zktime_last_attendance_upload_time"),
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
