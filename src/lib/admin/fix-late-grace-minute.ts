import { and, eq, sql } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import { getCompanyShiftConfig } from "@/lib/attendance/company-shift";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export type FixedLateGraceRow = {
  id: string;
  company: string;
  companySlug: string;
  employeeCode: string;
  fullName: string;
  shiftDate: string;
  checkInPkt: string;
};

/**
 * Clear is_late for check-ins that landed in the inclusive grace minute
 * (e.g. 09:15:xx or 18:15:xx), which are on-time under the updated rule.
 */
export async function fixLateGraceMinuteCheckIns(options?: {
  /** When set, only update this company slug (e.g. crest-led). */
  companySlug?: string;
}): Promise<{ updated: number; rows: FixedLateGraceRow[] }> {
  const companyRows = await db
    .select({ id: companies.id, name: companies.name, slug: companies.slug })
    .from(companies);

  const targets = options?.companySlug
    ? companyRows.filter((company) => company.slug === options.companySlug)
    : companyRows;

  const toFix: FixedLateGraceRow[] = [];

  for (const company of targets) {
    const shiftConfig = getCompanyShiftConfig(company.slug);
    const graceTotal =
      shiftConfig.expectedCheckInHour * 60 +
      shiftConfig.expectedCheckInMinute +
      shiftConfig.checkInGraceMinutes;
    const graceHour = Math.floor(graceTotal / 60) % 24;
    const graceMinute = graceTotal % 60;

    const rows = await db
      .select({
        id: attendanceDays.id,
        employeeCode: employees.employeeCode,
        fullName: employees.fullName,
        shiftDate: attendanceDays.shiftDate,
        checkInAt: attendanceDays.checkInAt,
      })
      .from(attendanceDays)
      .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
      .where(
        and(
          eq(employees.companyId, company.id),
          eq(attendanceDays.isLate, true),
          sql`${attendanceDays.checkInAt} IS NOT NULL`,
        ),
      );

    for (const row of rows) {
      if (!row.checkInAt) {
        continue;
      }

      const hour = Number(formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "H"));
      const minute = Number(formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "m"));
      if (hour !== graceHour || minute !== graceMinute) {
        continue;
      }

      toFix.push({
        id: row.id,
        company: company.name,
        companySlug: company.slug,
        employeeCode: row.employeeCode,
        fullName: row.fullName,
        shiftDate: row.shiftDate,
        checkInPkt: formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "yyyy-MM-dd h:mm:ss a"),
      });
    }
  }

  const now = new Date();
  for (const row of toFix) {
    await db
      .update(attendanceDays)
      .set({ isLate: false, updatedAt: now })
      .where(eq(attendanceDays.id, row.id));
  }

  return { updated: toFix.length, rows: toFix };
}
