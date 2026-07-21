import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, lateRelaxationRequests } from "@/db/schema";
import {
  assignLateFinesByShiftDate,
  computeLateFineTotals,
  getCalendarMonth,
  getCalendarMonthDateRange,
  type MonthlyLateSummary,
  summarizeMonthlyLates,
} from "./late-fines-utils";

export * from "./late-fines-utils";

/** Approved relaxation year-months keyed by employee id. */
export async function getApprovedLateRelaxationMonthsByEmployee(
  employeeIds: string[],
): Promise<Map<string, Set<string>>> {
  const result = new Map<string, Set<string>>();
  if (employeeIds.length === 0) {
    return result;
  }

  const { withLateRelaxationSchema } = await import("@/lib/late-relaxation/ensure-schema");

  const rows = await withLateRelaxationSchema(() =>
    db
      .select({
        employeeId: lateRelaxationRequests.employeeId,
        yearMonth: lateRelaxationRequests.yearMonth,
      })
      .from(lateRelaxationRequests)
      .where(
        and(
          inArray(lateRelaxationRequests.employeeId, employeeIds),
          eq(lateRelaxationRequests.status, "approved"),
        ),
      ),
  );

  for (const row of rows) {
    const months = result.get(row.employeeId) ?? new Set<string>();
    months.add(row.yearMonth);
    result.set(row.employeeId, months);
  }

  return result;
}

export async function unionApprovedLateRelaxationMonths(
  employeeIds: string[],
): Promise<Set<string>> {
  const byEmployee = await getApprovedLateRelaxationMonthsByEmployee(employeeIds);
  const union = new Set<string>();
  for (const months of byEmployee.values()) {
    for (const month of months) {
      union.add(month);
    }
  }
  return union;
}

export async function isLateFineWaivedForMonth(
  employeeId: string,
  yearMonth: string,
): Promise<boolean> {
  const { withLateRelaxationSchema } = await import("@/lib/late-relaxation/ensure-schema");

  const [row] = await withLateRelaxationSchema(() =>
    db
      .select({ id: lateRelaxationRequests.id })
      .from(lateRelaxationRequests)
      .where(
        and(
          eq(lateRelaxationRequests.employeeId, employeeId),
          eq(lateRelaxationRequests.yearMonth, yearMonth),
          eq(lateRelaxationRequests.status, "approved"),
        ),
      )
      .limit(1),
  );

  return Boolean(row);
}

export async function getEmployeeMonthlyLateSummary(
  employeeId: string,
  shiftDate: string,
  options: { includeTodayLate?: boolean } = {},
): Promise<MonthlyLateSummary> {
  const month = getCalendarMonth(shiftDate);
  const { from, to } = getCalendarMonthDateRange(month);

  const [rows, finesWaived] = await Promise.all([
    db
      .select({ shiftDate: attendanceDays.shiftDate })
      .from(attendanceDays)
      .where(
        and(
          eq(attendanceDays.employeeId, employeeId),
          eq(attendanceDays.isLate, true),
          gte(attendanceDays.shiftDate, from),
          lte(attendanceDays.shiftDate, to),
        ),
      )
      .orderBy(attendanceDays.shiftDate),
    isLateFineWaivedForMonth(employeeId, month),
  ]);

  const lateShiftDates = rows.map((row) => row.shiftDate);
  const lateCount = lateShiftDates.length;
  const summary = summarizeMonthlyLates(lateCount, { waived: finesWaived });
  const todayFinePkr =
    options.includeTodayLate && lateShiftDates.includes(shiftDate)
      ? (assignLateFinesByShiftDate(
          lateShiftDates.map((date) => ({ shiftDate: date, isLate: true })),
          finesWaived ? new Set([month]) : undefined,
        ).get(shiftDate) ?? 0)
      : 0;

  return {
    month,
    lateCount,
    todayFinePkr,
    finesWaived,
    ...summary,
  };
}

export async function countMonthlyLatesBeforeCheckIn(
  employeeId: string,
  shiftDate: string,
): Promise<number> {
  const month = getCalendarMonth(shiftDate);
  const { from, to } = getCalendarMonthDateRange(month);

  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, employeeId),
        eq(attendanceDays.isLate, true),
        gte(attendanceDays.shiftDate, from),
        lte(attendanceDays.shiftDate, to),
      ),
    );

  return result?.count ?? 0;
}

export type EmployeePendingLateFine = {
  fineableLates: number;
  pendingLateFinePkr: number;
  finesWaived: boolean;
};

export async function batchGetEmployeePendingLateFines(
  employeeIds: string[],
  shiftDate: string,
): Promise<Map<string, EmployeePendingLateFine>> {
  const result = new Map<string, EmployeePendingLateFine>();
  if (employeeIds.length === 0) {
    return result;
  }

  const month = getCalendarMonth(shiftDate);
  const { from, to } = getCalendarMonthDateRange(month);

  const [rows, waivedByEmployee] = await Promise.all([
    db
      .select({
        employeeId: attendanceDays.employeeId,
        shiftDate: attendanceDays.shiftDate,
      })
      .from(attendanceDays)
      .where(
        and(
          inArray(attendanceDays.employeeId, employeeIds),
          eq(attendanceDays.isLate, true),
          gte(attendanceDays.shiftDate, from),
          lte(attendanceDays.shiftDate, to),
        ),
      )
      .orderBy(attendanceDays.employeeId, attendanceDays.shiftDate),
    getApprovedLateRelaxationMonthsByEmployee(employeeIds),
  ]);

  const lateDaysByEmployee = new Map<string, { shiftDate: string; isLate: boolean }[]>();
  for (const row of rows) {
    const days = lateDaysByEmployee.get(row.employeeId) ?? [];
    days.push({ shiftDate: row.shiftDate, isLate: true });
    lateDaysByEmployee.set(row.employeeId, days);
  }

  for (const employeeId of employeeIds) {
    const waivedMonths = waivedByEmployee.get(employeeId);
    const finesWaived = waivedMonths?.has(month) ?? false;
    const totals = computeLateFineTotals(
      lateDaysByEmployee.get(employeeId) ?? [],
      waivedMonths,
    );
    result.set(employeeId, {
      fineableLates: totals.fineableLates,
      pendingLateFinePkr: totals.totalFinePkr,
      finesWaived,
    });
  }

  return result;
}
