import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import { preferAttendanceDay } from "@/lib/admin/attendance-day-preference";
import {
  buildCanonicalEmployeeIdMap,
  groupEmployeeDuplicateClusters,
  type EmployeeRecord,
} from "@/lib/admin/employee-identity";
import { effectiveAttendanceStatus } from "@/lib/attendance/effective-status";
import { assignLateFinesByShiftDate, computeLateFineTotals } from "@/lib/attendance/late-fines-utils";
import {
  getApprovedLateRelaxationMonthsByEmployee,
  unionApprovedLateRelaxationMonths,
} from "@/lib/attendance/late-fines";
import { getCompanyShiftConfig } from "@/lib/attendance/company-shift";
import { getRelatedEmployeeIdsForAttendance } from "@/lib/attendance/employee-attendance-identity";
import { countWorkingDaysForCompany } from "@/lib/leave/working-days";
import type { AttendanceListItem } from "./attendance-service";
import { getEmployee } from "./employees-service";
import type { ReportDateRange } from "./reports-date-range";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "./types";

export { preferAttendanceDay } from "@/lib/admin/attendance-day-preference";

export type { ReportDateRange } from "./reports-date-range";
export {
  defaultReportDateRange,
  resolveReportDateRange,
  validateReportDateRangeInput,
} from "./reports-date-range";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ReportTotals = {
  present: number;
  absent: number;
  leave: number;
  late: number;
  earlyLeave: number;
  fineableLates: number;
  lateFinePkr: number;
  records: number;
};

export type EmployeeReportSummary = ReportTotals & {
  shiftDaysInRange: number;
};

export type EmployeeReportRow = {
  shiftDate: string;
  status: "present" | "absent" | "leave" | "weekend_off";
  source: "auto" | "manual" | "system";
  checkInAt: Date | null;
  checkOutAt: Date | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  isMissedCheckout: boolean;
  lateFinePkr: number;
  totalBreakSeconds: number;
  notes: string | null;
};

export type EmployeeReport = {
  range: ReportDateRange;
  employee: {
    id: string;
    employeeCode: string;
    fullName: string;
    email: string;
    department: string | null;
    designation: string | null;
    isActive: boolean;
  };
  summary: EmployeeReportSummary;
  days: EmployeeReportRow[];
};

export type SummaryEmployeeRow = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  designation: string | null;
  isActive: boolean;
  totals: ReportTotals;
};

export type SummaryReport = {
  range: ReportDateRange;
  totals: ReportTotals;
  activeEmployeeCount: number;
  employees: SummaryEmployeeRow[];
};

function countShiftDaysInRange(from: string, to: string, companySlug: string): number {
  if (from > to) {
    return 0;
  }
  return countWorkingDaysForCompany(from, to, getCompanyShiftConfig(companySlug), companySlug);
}

export function validateReportDateRange(
  from: string | null | undefined,
  to: string | null | undefined,
): ServiceFailure | ServiceSuccess<ReportDateRange> {
  if (!from || !to) {
    return adminFailure(400, "MISSING_DATE_RANGE", "Query parameters from and to are required.");
  }
  if (!DATE_PATTERN.test(from) || !DATE_PATTERN.test(to)) {
    return adminFailure(400, "INVALID_DATE_RANGE", "Dates must be YYYY-MM-DD.");
  }
  if (from > to) {
    return adminFailure(400, "INVALID_DATE_RANGE", "from must be on or before to.");
  }
  return { ok: true, data: { from, to } };
}

function emptyTotals(): ReportTotals {
  return {
    present: 0,
    absent: 0,
    leave: 0,
    late: 0,
    earlyLeave: 0,
    fineableLates: 0,
    lateFinePkr: 0,
    records: 0,
  };
}

function accumulateTotals(totals: ReportTotals, row: AttendanceListItem): void {
  totals.records += 1;
  if (row.status === "present") {
    totals.present += 1;
  } else if (row.status === "absent") {
    totals.absent += 1;
  } else if (row.status === "leave") {
    totals.leave += 1;
  }
  if (row.isLate) {
    totals.late += 1;
  }
  if (row.isEarlyLeave) {
    totals.earlyLeave += 1;
  }
}

function mapAttendanceRow(
  row: typeof attendanceDays.$inferSelect,
  employee: typeof employees.$inferSelect,
): AttendanceListItem {
  return {
    id: row.id,
    employeeId: row.employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.fullName,
    employeeEmail: employee.email,
    shiftDate: row.shiftDate,
    status: effectiveAttendanceStatus(row),
    source: row.source,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    checkInLat: row.checkInLat,
    checkInLng: row.checkInLng,
    checkOutLat: row.checkOutLat,
    checkOutLng: row.checkOutLng,
    isLate: row.isLate,
    isEarlyLeave: row.isEarlyLeave,
    isMissedCheckout: row.isMissedCheckout,
    totalBreakSeconds: row.totalBreakSeconds,
    notes: row.notes,
    editedByUserId: row.editedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function fetchAttendanceInRange(
  range: ReportDateRange,
  options: { employeeIds?: string[]; companyId?: string } = {},
): Promise<AttendanceListItem[]> {
  const conditions = [
    gte(attendanceDays.shiftDate, range.from),
    lte(attendanceDays.shiftDate, range.to),
  ];
  if (options.employeeIds?.length) {
    conditions.push(inArray(attendanceDays.employeeId, options.employeeIds));
  }
  if (options.companyId) {
    conditions.push(eq(employees.companyId, options.companyId));
  }

  const rows = await db
    .select({
      attendance: attendanceDays,
      employee: employees,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(desc(attendanceDays.shiftDate));

  return rows.map(({ attendance, employee }) => mapAttendanceRow(attendance, employee));
}

/** Remap sibling employee attendance onto canonical ids and collapse duplicate shift dates. */
export function collapseAttendanceToCanonical(
  rows: AttendanceListItem[],
  canonicalByEmployeeId: Map<string, string>,
  employeesById: Map<string, EmployeeRecord>,
): AttendanceListItem[] {
  const byKey = new Map<string, AttendanceListItem>();

  for (const row of rows) {
    const canonicalId = canonicalByEmployeeId.get(row.employeeId) ?? row.employeeId;
    const canonical = employeesById.get(canonicalId);
    const remapped: AttendanceListItem = {
      ...row,
      employeeId: canonicalId,
      employeeCode: canonical?.employeeCode ?? row.employeeCode,
      employeeName: canonical?.fullName ?? row.employeeName,
      employeeEmail: canonical?.email ?? row.employeeEmail,
    };
    const key = `${canonicalId}:${row.shiftDate}`;
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferAttendanceDay(existing, remapped) : remapped);
  }

  return [...byKey.values()].sort((left, right) => right.shiftDate.localeCompare(left.shiftDate));
}

export async function getEmployeeReport(
  employeeId: string,
  from: string | null | undefined,
  to: string | null | undefined,
  companyId?: string,
): Promise<ServiceFailure | ServiceSuccess<EmployeeReport>> {
  const rangeResult = validateReportDateRange(from, to);
  if (!rangeResult.ok) {
    return rangeResult;
  }

  const employeeResult = await getEmployee(employeeId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  const employee = employeeResult.data;
  if (companyId && employee.companyId !== companyId) {
    return adminFailure(404, "EMPLOYEE_NOT_FOUND", "Employee not found.");
  }

  const [company] = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, employee.companyId))
    .limit(1);

  const relatedIds = await getRelatedEmployeeIdsForAttendance(employeeId);
  const companyEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.companyId, employee.companyId));
  const clusters = groupEmployeeDuplicateClusters(companyEmployees);
  const cluster = clusters.find((item) => item.members.some((member) => member.id === employeeId));
  const canonical = cluster?.canonical ?? employee;
  const memberIds = cluster?.members.map((member) => member.id) ?? relatedIds;
  const employeesById = new Map(companyEmployees.map((record) => [record.id, record]));
  const canonicalByEmployeeId = buildCanonicalEmployeeIdMap(companyEmployees);

  const rawRows = await fetchAttendanceInRange(rangeResult.data, {
    employeeIds: memberIds,
    companyId,
  });
  const rows = collapseAttendanceToCanonical(rawRows, canonicalByEmployeeId, employeesById);
  const waivedMonths = await unionApprovedLateRelaxationMonths(memberIds);
  const lateFinesByShiftDate = assignLateFinesByShiftDate(rows, waivedMonths);
  const lateFineTotals = computeLateFineTotals(rows, waivedMonths);
  const summary = {
    ...emptyTotals(),
    shiftDaysInRange: countShiftDaysInRange(
      rangeResult.data.from,
      rangeResult.data.to,
      company?.slug ?? "xorora",
    ),
    fineableLates: lateFineTotals.fineableLates,
    lateFinePkr: lateFineTotals.totalFinePkr,
  };

  for (const row of rows) {
    accumulateTotals(summary, row);
  }

  const days: EmployeeReportRow[] = rows.map((row) => ({
    shiftDate: row.shiftDate,
    status: row.status,
    source: row.source,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    isLate: row.isLate,
    isEarlyLeave: row.isEarlyLeave,
    isMissedCheckout: row.isMissedCheckout,
    lateFinePkr: lateFinesByShiftDate.get(row.shiftDate) ?? 0,
    totalBreakSeconds: row.totalBreakSeconds,
    notes: row.notes,
  }));

  return {
    ok: true,
    data: {
      range: rangeResult.data,
      employee: {
        id: canonical.id,
        employeeCode: canonical.employeeCode,
        fullName: canonical.fullName,
        email: canonical.email,
        department: canonical.department,
        designation: canonical.designation,
        isActive: canonical.isActive,
      },
      summary,
      days,
    },
  };
}

export async function getSummaryReport(
  from: string | null | undefined,
  to: string | null | undefined,
  companyId?: string,
): Promise<ServiceFailure | ServiceSuccess<SummaryReport>> {
  const rangeResult = validateReportDateRange(from, to);
  if (!rangeResult.ok) {
    return rangeResult;
  }

  const employeeQuery = companyId
    ? db
        .select()
        .from(employees)
        .where(eq(employees.companyId, companyId))
        .orderBy(asc(employees.fullName))
    : db.select().from(employees).orderBy(asc(employees.fullName));

  const [allCompanyEmployees, rawRows] = await Promise.all([
    employeeQuery,
    fetchAttendanceInRange(rangeResult.data, { companyId }),
  ]);

  const clusters = groupEmployeeDuplicateClusters(allCompanyEmployees);
  const canonicalByEmployeeId = buildCanonicalEmployeeIdMap(allCompanyEmployees);
  const employeesById = new Map(allCompanyEmployees.map((record) => [record.id, record]));
  const rows = collapseAttendanceToCanonical(rawRows, canonicalByEmployeeId, employeesById);

  const waivedByEmployee = await getApprovedLateRelaxationMonthsByEmployee(
    allCompanyEmployees.map((employee) => employee.id),
  );

  const totals = emptyTotals();
  const byEmployee = new Map<string, ReportTotals>();
  const employeeLateRows = new Map<string, AttendanceListItem[]>();

  for (const row of rows) {
    accumulateTotals(totals, row);
    let employeeTotals = byEmployee.get(row.employeeId);
    if (!employeeTotals) {
      employeeTotals = emptyTotals();
      byEmployee.set(row.employeeId, employeeTotals);
    }
    accumulateTotals(employeeTotals, row);

    const lateRows = employeeLateRows.get(row.employeeId) ?? [];
    lateRows.push(row);
    employeeLateRows.set(row.employeeId, lateRows);
  }

  let rangeFineableLates = 0;
  let rangeLateFinePkr = 0;

  for (const [employeeId, employeeRows] of employeeLateRows) {
    const employeeTotals = byEmployee.get(employeeId);
    if (!employeeTotals) {
      continue;
    }
    const cluster = clusters.find((item) => item.canonical.id === employeeId);
    const memberIds = cluster?.members.map((member) => member.id) ?? [employeeId];
    const waivedMonths = new Set<string>();
    for (const memberId of memberIds) {
      const months = waivedByEmployee.get(memberId);
      if (!months) {
        continue;
      }
      for (const month of months) {
        waivedMonths.add(month);
      }
    }
    const employeeFineTotals = computeLateFineTotals(employeeRows, waivedMonths);
    employeeTotals.fineableLates = employeeFineTotals.fineableLates;
    employeeTotals.lateFinePkr = employeeFineTotals.totalFinePkr;
    rangeFineableLates += employeeFineTotals.fineableLates;
    rangeLateFinePkr += employeeFineTotals.totalFinePkr;
  }

  totals.fineableLates = rangeFineableLates;
  totals.lateFinePkr = rangeLateFinePkr;

  const activeClusters = clusters.filter((cluster) => cluster.canonical.isActive);
  const employeeRows: SummaryEmployeeRow[] = activeClusters.map((cluster) => ({
    employeeId: cluster.canonical.id,
    employeeCode: cluster.canonical.employeeCode,
    fullName: cluster.canonical.fullName,
    department: cluster.canonical.department,
    designation: cluster.canonical.designation,
    isActive: cluster.canonical.isActive,
    totals: byEmployee.get(cluster.canonical.id) ?? emptyTotals(),
  }));

  // Include inactive canonical people who still have attendance in range.
  for (const [employeeId, employeeTotals] of byEmployee) {
    if (employeeRows.some((row) => row.employeeId === employeeId)) {
      continue;
    }
    const employee = employeesById.get(employeeId);
    if (!employee) {
      continue;
    }
    employeeRows.push({
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      department: employee.department,
      designation: employee.designation,
      isActive: employee.isActive,
      totals: employeeTotals,
    });
  }

  employeeRows.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    ok: true,
    data: {
      range: rangeResult.data,
      totals,
      activeEmployeeCount: activeClusters.length,
      employees: employeeRows,
    },
  };
}
