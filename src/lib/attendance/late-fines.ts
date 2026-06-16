import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays } from "@/db/schema";
import {
  assignLateFinesByShiftDate,
  computeLateFineTotals,
  getCalendarMonth,
  getCalendarMonthDateRange,
  type MonthlyLateSummary,
  summarizeMonthlyLates,
} from "./late-fines-utils";

export * from "./late-fines-utils";

export async function getEmployeeMonthlyLateSummary(
  employeeId: string,
  shiftDate: string,
  options: { includeTodayLate?: boolean } = {},
): Promise<MonthlyLateSummary> {
  const month = getCalendarMonth(shiftDate);
  const { from, to } = getCalendarMonthDateRange(month);

  const rows = await db
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
    .orderBy(attendanceDays.shiftDate);

  const lateShiftDates = rows.map((row) => row.shiftDate);
  const lateCount = lateShiftDates.length;
  const summary = summarizeMonthlyLates(lateCount);
  const todayFinePkr =
    options.includeTodayLate && lateShiftDates.includes(shiftDate)
      ? (assignLateFinesByShiftDate(
          lateShiftDates.map((date) => ({ shiftDate: date, isLate: true })),
        ).get(shiftDate) ?? 0)
      : 0;

  return {
    month,
    lateCount,
    todayFinePkr,
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

  const rows = await db
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
    .orderBy(attendanceDays.employeeId, attendanceDays.shiftDate);

  const lateDaysByEmployee = new Map<string, { shiftDate: string; isLate: boolean }[]>();
  for (const row of rows) {
    const days = lateDaysByEmployee.get(row.employeeId) ?? [];
    days.push({ shiftDate: row.shiftDate, isLate: true });
    lateDaysByEmployee.set(row.employeeId, days);
  }

  for (const employeeId of employeeIds) {
    const totals = computeLateFineTotals(lateDaysByEmployee.get(employeeId) ?? []);
    result.set(employeeId, {
      fineableLates: totals.fineableLates,
      pendingLateFinePkr: totals.totalFinePkr,
    });
  }

  return result;
}
