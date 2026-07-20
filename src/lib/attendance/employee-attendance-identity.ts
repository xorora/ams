import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import {
  areLikelyDuplicateEmployees,
  codesMatch,
  normalizeEmployeeName,
  type EmployeeRecord,
  pickCanonicalEmployee,
} from "@/lib/admin/employee-identity";
import { linkUserToEmployeeRecord } from "@/lib/auth/employee-link";
import { getShiftDateForCompany, getShiftConfigForEmployee } from "./company-shift";
import { reconcileEmployeeAttendanceFromLog } from "./attendance-log-sync";

async function loadCompanyEmployees(companyId: string): Promise<EmployeeRecord[]> {
  return db.select().from(employees).where(eq(employees.companyId, companyId));
}

export function findDuplicateCluster(
  employee: EmployeeRecord,
  companyEmployees: EmployeeRecord[],
): EmployeeRecord[] {
  const sameName = companyEmployees.filter(
    (record) => normalizeEmployeeName(record.fullName) === normalizeEmployeeName(employee.fullName),
  );

  if (sameName.length <= 1) {
    return [employee];
  }

  const cluster = sameName.filter(
    (record) => record.id === employee.id || areLikelyDuplicateEmployees(record, employee),
  );

  return cluster.length > 0 ? cluster : [employee];
}

/** All employee rows that may hold device-synced attendance for the signed-in user. */
export async function getRelatedEmployeeIdsForAttendance(
  employeeId: string,
): Promise<string[]> {
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    return [employeeId];
  }

  const companyEmployees = await loadCompanyEmployees(employee.companyId);
  const ids = new Set<string>([employee.id]);

  for (const record of companyEmployees) {
    if (codesMatch(record.employeeCode, employee.employeeCode)) {
      ids.add(record.id);
    }
  }

  for (const record of findDuplicateCluster(employee, companyEmployees)) {
    ids.add(record.id);
  }

  return [...ids];
}

async function hasAttendanceForShift(employeeId: string, shiftDate: string): Promise<boolean> {
  const [row] = await db
    .select({
      checkInAt: attendanceDays.checkInAt,
      status: attendanceDays.status,
      checkOutAt: attendanceDays.checkOutAt,
    })
    .from(attendanceDays)
    .where(and(eq(attendanceDays.employeeId, employeeId), eq(attendanceDays.shiftDate, shiftDate)))
    .limit(1);

  if (!row) {
    return false;
  }

  return row.checkInAt != null || (row.status === "present" && row.checkOutAt == null);
}

async function findLatestAttendanceEmployeeId(
  candidateIds: string[],
): Promise<string | null> {
  const [row] = await db
    .select({ employeeId: attendanceDays.employeeId })
    .from(attendanceDays)
    .where(
      and(
        inArray(attendanceDays.employeeId, candidateIds),
        or(isNotNull(attendanceDays.checkInAt), eq(attendanceDays.status, "present")),
      ),
    )
    .orderBy(desc(attendanceDays.shiftDate))
    .limit(1);

  return row?.employeeId ?? null;
}

/** Move or merge attendance from duplicate employee rows onto the signed-in employee. */
export async function adoptSiblingAttendanceToEmployee(
  primaryEmployeeId: string,
  now: Date = new Date(),
): Promise<void> {
  const relatedIds = await getRelatedEmployeeIdsForAttendance(primaryEmployeeId);
  if (relatedIds.length <= 1) {
    return;
  }

  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, primaryEmployeeId))
    .limit(1);

  if (!employee) {
    return;
  }

  const [company] = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, employee.companyId))
    .limit(1);

  const shiftConfig = getShiftConfigForEmployee(company?.slug ?? "xorora", employee.fullName);
  const shiftDate = getShiftDateForCompany(now, shiftConfig);

  const [primaryRow] = await db
    .select()
    .from(attendanceDays)
    .where(
      and(eq(attendanceDays.employeeId, primaryEmployeeId), eq(attendanceDays.shiftDate, shiftDate)),
    )
    .limit(1);

  for (const siblingId of relatedIds) {
    if (siblingId === primaryEmployeeId) {
      continue;
    }

    const [siblingRow] = await db
      .select()
      .from(attendanceDays)
      .where(
        and(eq(attendanceDays.employeeId, siblingId), eq(attendanceDays.shiftDate, shiftDate)),
      )
      .limit(1);

    if (!siblingRow) {
      continue;
    }

    const siblingHasCheckIn =
      siblingRow.checkInAt != null ||
      (siblingRow.status === "present" && siblingRow.checkOutAt == null);

    if (!siblingHasCheckIn) {
      continue;
    }

    if (!primaryRow) {
      await db
        .update(attendanceDays)
        .set({ employeeId: primaryEmployeeId, updatedAt: now })
        .where(eq(attendanceDays.id, siblingRow.id));
      return;
    }

    if (!primaryRow.checkInAt && siblingRow.checkInAt) {
      await db
        .update(attendanceDays)
        .set({
          status: "present",
          checkInAt: siblingRow.checkInAt,
          checkOutAt: primaryRow.checkOutAt ?? siblingRow.checkOutAt,
          isLate: siblingRow.isLate,
          isEarlyLeave: primaryRow.isEarlyLeave || siblingRow.isEarlyLeave,
          isMissedCheckout: siblingRow.isMissedCheckout,
          updatedAt: now,
        })
        .where(eq(attendanceDays.id, primaryRow.id));

      await db.delete(attendanceDays).where(eq(attendanceDays.id, siblingRow.id));
      return;
    }
  }
}

/**
 * Reconcile device attendance and keep the signed-in user on the employee row
 * that owns today's attendance log entry.
 */
export async function resolveEmployeeIdForAttendance(
  employeeId: string,
  now: Date = new Date(),
): Promise<string> {
  const [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (!employee) {
    return employeeId;
  }

  const relatedIds = await getRelatedEmployeeIdsForAttendance(employeeId);

  for (const candidateId of relatedIds) {
    await reconcileEmployeeAttendanceFromLog(candidateId, now);
  }

  await adoptSiblingAttendanceToEmployee(employeeId, now);

  const [company] = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, employee.companyId))
    .limit(1);

  const shiftConfig = getShiftConfigForEmployee(company?.slug ?? "xorora", employee.fullName);
  const shiftDate = getShiftDateForCompany(now, shiftConfig);

  if (await hasAttendanceForShift(employeeId, shiftDate)) {
    return employeeId;
  }

  for (const candidateId of relatedIds) {
    if (candidateId === employeeId) {
      continue;
    }
    if (await hasAttendanceForShift(candidateId, shiftDate) && employee.userId) {
      await linkUserToEmployeeRecord(employee.userId, candidateId);
      return candidateId;
    }
  }

  const latestAttendanceEmployeeId = await findLatestAttendanceEmployeeId(relatedIds);
  if (latestAttendanceEmployeeId && latestAttendanceEmployeeId !== employeeId && employee.userId) {
    await linkUserToEmployeeRecord(employee.userId, latestAttendanceEmployeeId);
    return latestAttendanceEmployeeId;
  }

  if (latestAttendanceEmployeeId) {
    return latestAttendanceEmployeeId;
  }

  if (relatedIds.length > 1) {
    const companyEmployees = await loadCompanyEmployees(employee.companyId);
    const cluster = findDuplicateCluster(employee, companyEmployees);
    const canonical = pickCanonicalEmployee(cluster);
    if (canonical.id !== employeeId && employee.userId && !canonical.userId) {
      await linkUserToEmployeeRecord(employee.userId, canonical.id);
    }
    return canonical.id;
  }

  return employeeId;
}
