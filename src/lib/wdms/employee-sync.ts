import { desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, machinePunches, wdmsTerminals } from "@/db/schema";
import { WdmsClient } from "@/lib/wdms/client";
import {
  type AllCompaniesPushResult,
  type CompanyPushDetail,
  pushAllCompaniesToWdms,
  pushAmsEmployeeToWdms,
  pushCompanyToWdmsBySlug,
} from "@/lib/wdms/company-push";
import { getDefaultCompanySlug } from "@/lib/wdms/config";
import {
  setSyncStateValue,
  WDMS_LAST_COMPANY_PUSH_AT,
  WDMS_LAST_EMPLOYEE_SYNC_AT,
  WDMS_LAST_TERMINAL_SYNC_AT,
} from "@/lib/wdms/sync-state";

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

export async function pullEmployeesFromWdms(client: WdmsClient): Promise<EmployeePullResult> {
  const wdmsEmployees = await client.getAllEmployees();
  const defaultCompanyId = await resolveDefaultCompanyId();

  if (!defaultCompanyId) {
    throw new Error(`Default company not found: ${getDefaultCompanySlug()}`);
  }

  let updated = 0;
  let created = 0;

  for (const wdmsEmp of wdmsEmployees) {
    if (wdmsEmp.app_status !== 0) {
      continue;
    }

    const fullName = [wdmsEmp.first_name, wdmsEmp.last_name].filter(Boolean).join(" ").trim();
    const department = wdmsEmp.department?.dept_name ?? null;

    const existing = await db.query.employees.findFirst({
      where: eq(employees.employeeCode, wdmsEmp.emp_code),
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
    const localPart = normalizeName(fullName) || wdmsEmp.emp_code;
    const email = `${localPart}@${domain}`.toLowerCase();

    const [emailConflict] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.email, email))
      .limit(1);

    const resolvedEmail = emailConflict
      ? `${localPart}.${wdmsEmp.emp_code}@${domain}`.toLowerCase()
      : email;

    await db.insert(employees).values({
      employeeCode: wdmsEmp.emp_code,
      fullName: fullName || wdmsEmp.emp_code,
      email: resolvedEmail,
      companyId: defaultCompanyId,
      department,
    });
    created += 1;
  }

  await setSyncStateValue(WDMS_LAST_EMPLOYEE_SYNC_AT, new Date().toISOString());

  return { fetched: wdmsEmployees.length, updated, created };
}

export type { AllCompaniesPushResult, CompanyPushDetail };

export async function pushCompanyToWdms(
  client: WdmsClient,
  options: { companySlug?: string } = {},
): Promise<AllCompaniesPushResult | CompanyPushDetail> {
  if (options.companySlug) {
    return pushCompanyToWdmsBySlug(client, options.companySlug);
  }
  return pushAllCompaniesToWdms(client);
}

export async function pushEmployeeById(employeeId: string): Promise<void> {
  const client = WdmsClient.tryFromEnv();
  if (!client) {
    return;
  }

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
  });

  if (!employee) {
    return;
  }

  await pushAmsEmployeeToWdms(client, employee);
}

export async function syncTerminalsFromWdms(client: WdmsClient): Promise<number> {
  const terminals = await client.getAllTerminals();
  const now = new Date();

  for (const terminal of terminals) {
    const lastActivity = terminal.last_activity ? new Date(terminal.last_activity) : null;
    const existing = await db.query.wdmsTerminals.findFirst({
      where: eq(wdmsTerminals.serialNumber, terminal.sn),
    });

    if (existing) {
      await db
        .update(wdmsTerminals)
        .set({
          alias: terminal.alias || existing.alias,
          ipAddress: terminal.ip_address ?? existing.ipAddress,
          firmwareVersion: terminal.firmware_version ?? existing.firmwareVersion,
          lastSeenAt: lastActivity ?? existing.lastSeenAt,
          updatedAt: now,
        })
        .where(eq(wdmsTerminals.id, existing.id));
      continue;
    }

    await db.insert(wdmsTerminals).values({
      serialNumber: terminal.sn,
      alias: terminal.alias,
      ipAddress: terminal.ip_address ?? null,
      firmwareVersion: terminal.firmware_version ?? null,
      lastSeenAt: lastActivity,
    });
  }

  await setSyncStateValue(WDMS_LAST_TERMINAL_SYNC_AT, now.toISOString());
  return terminals.length;
}

export type UnmappedWdmsPunch = {
  empCode: string;
  machineNo: string | null;
  machineEmpName: string | null;
  punchCount: number;
  lastPunchAt: Date;
};

export async function listUnmappedPunches(): Promise<UnmappedWdmsPunch[]> {
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

  const grouped = new Map<string, UnmappedWdmsPunch>();

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
  const { getSyncStateValue } = await import("@/lib/wdms/sync-state");
  const devices = await db.select().from(wdmsTerminals).orderBy(desc(wdmsTerminals.lastSeenAt));

  const [lastAttendanceSync, lastEmployeeSync, lastTerminalSync, lastCompanyPush] =
    await Promise.all([
      getSyncStateValue("wdms_last_attendance_upload_time"),
      getSyncStateValue(WDMS_LAST_EMPLOYEE_SYNC_AT),
      getSyncStateValue(WDMS_LAST_TERMINAL_SYNC_AT),
      getSyncStateValue(WDMS_LAST_COMPANY_PUSH_AT),
    ]);

  return {
    devices,
    syncState: {
      lastAttendanceSync,
      lastEmployeeSync,
      lastTerminalSync,
      lastCompanyPush,
    },
  };
}
