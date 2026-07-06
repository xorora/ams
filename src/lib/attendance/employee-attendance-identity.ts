import { and, desc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import {
  areLikelyDuplicateEmployees,
  normalizeEmployeeName,
  type EmployeeRecord,
  pickCanonicalEmployee,
} from "@/lib/admin/employee-identity";
import { linkUserToEmployeeRecord } from "@/lib/auth/employee-link";
import { getCompanyShiftConfig, getShiftDateForCompany } from "./company-shift";
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

/**
 * When ZKTime sync created a duplicate employee row, attendance may live on a sibling
 * record while the signed-in user points at another. Prefer the row that has attendance.
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

  const companyEmployees = await loadCompanyEmployees(employee.companyId);
  const cluster = findDuplicateCluster(employee, companyEmployees);

  for (const candidate of cluster) {
    await reconcileEmployeeAttendanceFromLog(candidate.id, now);
  }

  if (cluster.length <= 1) {
    return employeeId;
  }

  const [company] = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, employee.companyId))
    .limit(1);

  const shiftConfig = getCompanyShiftConfig(company?.slug ?? "xorora");
  const shiftDate = getShiftDateForCompany(now, shiftConfig);

  for (const candidate of cluster) {
    if (await hasAttendanceForShift(candidate.id, shiftDate)) {
      if (candidate.id !== employeeId && employee.userId) {
        await linkUserToEmployeeRecord(employee.userId, candidate.id);
      }
      return candidate.id;
    }
  }

  const latestAttendanceEmployeeId = await findLatestAttendanceEmployeeId(
    cluster.map((record) => record.id),
  );
  if (latestAttendanceEmployeeId && latestAttendanceEmployeeId !== employeeId && employee.userId) {
    await linkUserToEmployeeRecord(employee.userId, latestAttendanceEmployeeId);
    return latestAttendanceEmployeeId;
  }

  if (latestAttendanceEmployeeId) {
    return latestAttendanceEmployeeId;
  }

  const canonical = pickCanonicalEmployee(cluster);
  if (canonical.id !== employeeId && employee.userId && !canonical.userId) {
    await linkUserToEmployeeRecord(employee.userId, canonical.id);
  }

  return canonical.id;
}
