import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, employees } from "@/db/schema";
import type { AttendanceListItem } from "./attendance-service";
import { getEmployee } from "./employees-service";
import type { ReportDateRange } from "./reports-date-range";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "./types";

export type { ReportDateRange } from "./reports-date-range";
export { defaultReportDateRange } from "./reports-date-range";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ReportTotals = {
  present: number;
  absent: number;
  leave: number;
  late: number;
  earlyLeave: number;
  records: number;
};

export type EmployeeReportSummary = ReportTotals & {
  shiftDaysInRange: number;
};

export type EmployeeReportRow = {
  shiftDate: string;
  status: "present" | "absent" | "leave";
  source: "auto" | "manual" | "system";
  checkInAt: Date | null;
  checkOutAt: Date | null;
  isLate: boolean;
  isEarlyLeave: boolean;
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
  isActive: boolean;
  totals: ReportTotals;
};

export type SummaryReport = {
  range: ReportDateRange;
  totals: ReportTotals;
  activeEmployeeCount: number;
  employees: SummaryEmployeeRow[];
};

function countShiftDaysInRange(from: string, to: string): number {
  const start = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
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
    status: row.status,
    source: row.source,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    checkInLat: row.checkInLat,
    checkInLng: row.checkInLng,
    checkOutLat: row.checkOutLat,
    checkOutLng: row.checkOutLng,
    isLate: row.isLate,
    isEarlyLeave: row.isEarlyLeave,
    totalBreakSeconds: row.totalBreakSeconds,
    notes: row.notes,
    editedByUserId: row.editedByUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function fetchAttendanceInRange(
  range: ReportDateRange,
  employeeId?: string,
): Promise<AttendanceListItem[]> {
  const conditions = [
    gte(attendanceDays.shiftDate, range.from),
    lte(attendanceDays.shiftDate, range.to),
  ];
  if (employeeId) {
    conditions.push(eq(attendanceDays.employeeId, employeeId));
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

export async function getEmployeeReport(
  employeeId: string,
  from: string | null | undefined,
  to: string | null | undefined,
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
  const rows = await fetchAttendanceInRange(rangeResult.data, employeeId);
  const summary = {
    ...emptyTotals(),
    shiftDaysInRange: countShiftDaysInRange(rangeResult.data.from, rangeResult.data.to),
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
    totalBreakSeconds: row.totalBreakSeconds,
    notes: row.notes,
  }));

  return {
    ok: true,
    data: {
      range: rangeResult.data,
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: employee.email,
        department: employee.department,
        isActive: employee.isActive,
      },
      summary,
      days,
    },
  };
}

export async function getSummaryReport(
  from: string | null | undefined,
  to: string | null | undefined,
): Promise<ServiceFailure | ServiceSuccess<SummaryReport>> {
  const rangeResult = validateReportDateRange(from, to);
  if (!rangeResult.ok) {
    return rangeResult;
  }

  const [activeEmployees, rows] = await Promise.all([
    db
      .select()
      .from(employees)
      .where(eq(employees.isActive, true))
      .orderBy(asc(employees.fullName)),
    fetchAttendanceInRange(rangeResult.data),
  ]);

  const totals = emptyTotals();
  const byEmployee = new Map<string, ReportTotals>();

  for (const row of rows) {
    accumulateTotals(totals, row);
    let employeeTotals = byEmployee.get(row.employeeId);
    if (!employeeTotals) {
      employeeTotals = emptyTotals();
      byEmployee.set(row.employeeId, employeeTotals);
    }
    accumulateTotals(employeeTotals, row);
  }

  const employeeRows: SummaryEmployeeRow[] = activeEmployees.map((employee) => ({
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    department: employee.department,
    isActive: employee.isActive,
    totals: byEmployee.get(employee.id) ?? emptyTotals(),
  }));

  for (const [employeeId, employeeTotals] of byEmployee) {
    if (!activeEmployees.some((e) => e.id === employeeId)) {
      const [inactive] = await db
        .select()
        .from(employees)
        .where(eq(employees.id, employeeId))
        .limit(1);
      if (inactive) {
        employeeRows.push({
          employeeId: inactive.id,
          employeeCode: inactive.employeeCode,
          fullName: inactive.fullName,
          department: inactive.department,
          isActive: inactive.isActive,
          totals: employeeTotals,
        });
      }
    }
  }

  employeeRows.sort((a, b) => a.fullName.localeCompare(b.fullName));

  return {
    ok: true,
    data: {
      range: rangeResult.data,
      totals,
      activeEmployeeCount: activeEmployees.length,
      employees: employeeRows,
    },
  };
}
