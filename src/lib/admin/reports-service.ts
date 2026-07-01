import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, employees } from "@/db/schema";
import { assignLateFinesByShiftDate, computeLateFineTotals } from "@/lib/attendance/late-fines";
import { countWorkingDays } from "@/lib/leave/working-days";
import type { AttendanceListItem } from "./attendance-service";
import { getEmployee } from "./employees-service";
import type { ReportDateRange } from "./reports-date-range";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "./types";

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

function countShiftDaysInRange(from: string, to: string): number {
  if (from > to) {
    return 0;
  }
  return countWorkingDays(from, to);
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
  options: { employeeId?: string; companyId?: string } = {},
): Promise<AttendanceListItem[]> {
  const conditions = [
    gte(attendanceDays.shiftDate, range.from),
    lte(attendanceDays.shiftDate, range.to),
  ];
  if (options.employeeId) {
    conditions.push(eq(attendanceDays.employeeId, options.employeeId));
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

  const rows = await fetchAttendanceInRange(rangeResult.data, { employeeId, companyId });
  const lateFinesByShiftDate = assignLateFinesByShiftDate(rows);
  const lateFineTotals = computeLateFineTotals(rows);
  const summary = {
    ...emptyTotals(),
    shiftDaysInRange: countShiftDaysInRange(rangeResult.data.from, rangeResult.data.to),
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
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: employee.fullName,
        email: employee.email,
        department: employee.department,
        designation: employee.designation,
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
  companyId?: string,
): Promise<ServiceFailure | ServiceSuccess<SummaryReport>> {
  const rangeResult = validateReportDateRange(from, to);
  if (!rangeResult.ok) {
    return rangeResult;
  }

  const employeeConditions = [eq(employees.isActive, true)];
  if (companyId) {
    employeeConditions.push(eq(employees.companyId, companyId));
  }

  const [activeEmployees, rows] = await Promise.all([
    db
      .select()
      .from(employees)
      .where(and(...employeeConditions))
      .orderBy(asc(employees.fullName)),
    fetchAttendanceInRange(rangeResult.data, { companyId }),
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

  const employeeLateRows = new Map<string, AttendanceListItem[]>();
  for (const row of rows) {
    const employeeRows = employeeLateRows.get(row.employeeId) ?? [];
    employeeRows.push(row);
    employeeLateRows.set(row.employeeId, employeeRows);
  }

  const rangeLateFineTotals = computeLateFineTotals(rows);
  totals.fineableLates = rangeLateFineTotals.fineableLates;
  totals.lateFinePkr = rangeLateFineTotals.totalFinePkr;

  for (const [employeeId, employeeRows] of employeeLateRows) {
    const employeeTotals = byEmployee.get(employeeId);
    if (!employeeTotals) {
      continue;
    }
    const employeeFineTotals = computeLateFineTotals(employeeRows);
    employeeTotals.fineableLates = employeeFineTotals.fineableLates;
    employeeTotals.lateFinePkr = employeeFineTotals.totalFinePkr;
  }

  const employeeRows: SummaryEmployeeRow[] = activeEmployees.map((employee) => ({
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    department: employee.department,
    designation: employee.designation,
    isActive: employee.isActive,
    totals: byEmployee.get(employee.id) ?? emptyTotals(),
  }));

  for (const [employeeId, employeeTotals] of byEmployee) {
    if (!activeEmployees.some((e) => e.id === employeeId)) {
      const inactiveConditions = [eq(employees.id, employeeId)];
      if (companyId) {
        inactiveConditions.push(eq(employees.companyId, companyId));
      }
      const [inactive] = await db
        .select()
        .from(employees)
        .where(and(...inactiveConditions))
        .limit(1);
      if (inactive) {
        employeeRows.push({
          employeeId: inactive.id,
          employeeCode: inactive.employeeCode,
          fullName: inactive.fullName,
          department: inactive.department,
          designation: inactive.designation,
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
