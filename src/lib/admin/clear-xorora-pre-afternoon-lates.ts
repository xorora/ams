import { and, eq, lt, sql } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import {
  XORORA_AFTERNOON_SHIFT_EFFECTIVE_DATE,
  XORORA_EVENING_SHIFT,
  getShiftConfigForEmployee,
  isLateCheckInForCompany,
} from "@/lib/attendance/company-shift";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export type ClearedPreAfternoonLateRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  shiftDate: string;
  checkInPkt: string;
};

/**
 * Clear is_late for Xorora shift dates before the afternoon cutover when the
 * check-in was on time under the legacy evening (6pm) schedule.
 */
export async function clearXororaPreAfternoonFalseLates(options?: {
  /** Defaults to all Xorora days before the cutover. */
  shiftDate?: string;
}): Promise<{ updated: number; rows: ClearedPreAfternoonLateRow[] }> {
  const [xorora] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, "xorora"))
    .limit(1);

  if (!xorora) {
    return { updated: 0, rows: [] };
  }

  const shiftDateFilter = options?.shiftDate
    ? eq(attendanceDays.shiftDate, options.shiftDate)
    : lt(attendanceDays.shiftDate, XORORA_AFTERNOON_SHIFT_EFFECTIVE_DATE);

  const rows = await db
    .select({
      id: attendanceDays.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      shiftPreset: employees.shiftPreset,
      shiftDate: attendanceDays.shiftDate,
      checkInAt: attendanceDays.checkInAt,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .where(
      and(
        eq(employees.companyId, xorora.id),
        eq(attendanceDays.isLate, true),
        sql`${attendanceDays.checkInAt} IS NOT NULL`,
        shiftDateFilter,
      ),
    );

  const toClear: ClearedPreAfternoonLateRow[] = [];

  for (const row of rows) {
    if (!row.checkInAt) {
      continue;
    }

    const config = getShiftConfigForEmployee(
      "xorora",
      row.shiftPreset,
      row.fullName,
      row.shiftDate,
    );
    // Defensive: cutover path must evaluate evening rules for these dates.
    const eveningAware = row.shiftDate < XORORA_AFTERNOON_SHIFT_EFFECTIVE_DATE
      ? XORORA_EVENING_SHIFT
      : config;

    if (isLateCheckInForCompany(row.checkInAt, row.shiftDate, eveningAware)) {
      continue;
    }

    toClear.push({
      id: row.id,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      shiftDate: row.shiftDate,
      checkInPkt: formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "yyyy-MM-dd h:mm:ss a"),
    });
  }

  const now = new Date();
  for (const row of toClear) {
    await db
      .update(attendanceDays)
      .set({ isLate: false, updatedAt: now })
      .where(eq(attendanceDays.id, row.id));
  }

  return { updated: toClear.length, rows: toClear };
}
