import { and, eq, gte, lte } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import {
  getShiftConfigForEmployee,
  isLateCheckInForCompany,
} from "@/lib/attendance/company-shift";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export type RecalcEmployeeLateRow = {
  id: string;
  employeeCode: string;
  fullName: string;
  shiftDate: string;
  checkInPkt: string;
  wasLate: boolean;
  nowLate: boolean;
};

/**
 * Recompute is_late for one employee over a shift-date range using their
 * current company + shiftPreset rules.
 */
export async function recalcEmployeeLateFlags(options: {
  employeeId: string;
  from: string;
  to: string;
}): Promise<{ updated: number; cleared: number; marked: number; rows: RecalcEmployeeLateRow[] }> {
  const [employee] = await db
    .select({
      id: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      shiftPreset: employees.shiftPreset,
      companySlug: companies.slug,
    })
    .from(employees)
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(eq(employees.id, options.employeeId))
    .limit(1);

  if (!employee) {
    return { updated: 0, cleared: 0, marked: 0, rows: [] };
  }

  const rows = await db
    .select({
      id: attendanceDays.id,
      shiftDate: attendanceDays.shiftDate,
      isLate: attendanceDays.isLate,
      checkInAt: attendanceDays.checkInAt,
    })
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, employee.id),
        gte(attendanceDays.shiftDate, options.from),
        lte(attendanceDays.shiftDate, options.to),
      ),
    );

  const changes: RecalcEmployeeLateRow[] = [];
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
          employeeCode: employee.employeeCode,
          fullName: employee.fullName,
          shiftDate: row.shiftDate,
          checkInPkt: "—",
          wasLate: true,
          nowLate: false,
        });
      }
      continue;
    }

    const config = getShiftConfigForEmployee(
      employee.companySlug,
      employee.shiftPreset,
      employee.fullName,
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
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      shiftDate: row.shiftDate,
      checkInPkt: formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "yyyy-MM-dd h:mm:ss a"),
      wasLate: row.isLate,
      nowLate,
    });
  }

  return { updated: changes.length, cleared, marked, rows: changes };
}
