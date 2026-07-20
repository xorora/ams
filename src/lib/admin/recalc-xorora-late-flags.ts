import { and, eq, gte, lte } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import {
  getShiftConfigForEmployee,
  isLateCheckInForCompany,
} from "@/lib/attendance/company-shift";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export type RecalcLateRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  shiftDate: string;
  checkInPkt: string;
  wasLate: boolean;
  nowLate: boolean;
};

/**
 * Recompute is_late for Xorora attendance in a date range using cutover-aware
 * shift rules (evening before 2026-07-21, then preset/afternoon).
 */
export async function recalcXororaLateFlags(options: {
  from: string;
  to: string;
}): Promise<{ updated: number; cleared: number; marked: number; rows: RecalcLateRow[] }> {
  const [xorora] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, "xorora"))
    .limit(1);

  if (!xorora) {
    return { updated: 0, cleared: 0, marked: 0, rows: [] };
  }

  const rows = await db
    .select({
      id: attendanceDays.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      shiftPreset: employees.shiftPreset,
      shiftDate: attendanceDays.shiftDate,
      isLate: attendanceDays.isLate,
      checkInAt: attendanceDays.checkInAt,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .where(
      and(
        eq(employees.companyId, xorora.id),
        gte(attendanceDays.shiftDate, options.from),
        lte(attendanceDays.shiftDate, options.to),
      ),
    );

  const changes: RecalcLateRow[] = [];
  let cleared = 0;
  let marked = 0;
  const now = new Date();

  for (const row of rows) {
    if (!row.checkInAt) {
      if (row.isLate) {
        await db
          .update(attendanceDays)
          .set({ isLate: false, updatedAt: now })
          .where(eq(attendanceDays.id, row.id));
        cleared += 1;
        changes.push({
          id: row.id,
          employeeCode: row.employeeCode,
          fullName: row.fullName,
          shiftDate: row.shiftDate,
          checkInPkt: "—",
          wasLate: true,
          nowLate: false,
        });
      }
      continue;
    }

    const config = getShiftConfigForEmployee(
      "xorora",
      row.shiftPreset,
      row.fullName,
      row.shiftDate,
    );
    const nowLate = isLateCheckInForCompany(row.checkInAt, row.shiftDate, config);
    if (nowLate === row.isLate) {
      continue;
    }

    await db
      .update(attendanceDays)
      .set({ isLate: nowLate, updatedAt: now })
      .where(eq(attendanceDays.id, row.id));

    if (nowLate) {
      marked += 1;
    } else {
      cleared += 1;
    }

    changes.push({
      id: row.id,
      employeeCode: row.employeeCode,
      fullName: row.fullName,
      shiftDate: row.shiftDate,
      checkInPkt: formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "yyyy-MM-dd h:mm:ss a"),
      wasLate: row.isLate,
      nowLate,
    });
  }

  return { updated: changes.length, cleared, marked, rows: changes };
}
