import { and, eq } from "drizzle-orm";
import { fromZonedTime } from "date-fns-tz";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import {
  getCompanyShiftConfig,
  isEarlyLeaveForCompany,
  isLateCheckInForCompany,
} from "@/lib/attendance/company-shift";

export type BackfillShiftEntry = {
  employeeCode: string;
  checkInPkt: string;
  checkOutPkt?: string | null;
};

function pktTimeOnShiftDate(shiftDate: string, time: string): Date {
  return fromZonedTime(`${shiftDate} ${time}:00`, BUSINESS_TIMEZONE);
}

export async function backfillShiftAttendance(
  companySlug: string,
  shiftDate: string,
  entries: BackfillShiftEntry[],
): Promise<{ created: number; updated: number; skipped: number; details: string[] }> {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, companySlug))
    .limit(1);

  if (!company) {
    throw new Error(`Company not found: ${companySlug}`);
  }

  const employeeRows = await db
    .select({ id: employees.id, employeeCode: employees.employeeCode })
    .from(employees)
    .where(eq(employees.companyId, company.id));

  const byCode = new Map(employeeRows.map((row) => [row.employeeCode, row.id]));
  const shiftConfig = getCompanyShiftConfig(companySlug);
  const now = new Date();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const details: string[] = [];

  for (const entry of entries) {
    const employeeId = byCode.get(entry.employeeCode);
    if (!employeeId) {
      skipped += 1;
      details.push(`${entry.employeeCode}: employee not found`);
      continue;
    }

    const checkInAt = pktTimeOnShiftDate(shiftDate, entry.checkInPkt);
    const checkOutAt = entry.checkOutPkt
      ? pktTimeOnShiftDate(shiftDate, entry.checkOutPkt)
      : null;

    const isLate = isLateCheckInForCompany(checkInAt, shiftDate, shiftConfig);
    const isEarlyLeave = checkOutAt
      ? isEarlyLeaveForCompany(checkOutAt, shiftDate, shiftConfig)
      : false;

    const [existing] = await db
      .select()
      .from(attendanceDays)
      .where(and(eq(attendanceDays.employeeId, employeeId), eq(attendanceDays.shiftDate, shiftDate)))
      .limit(1);

    if (existing) {
      await db
        .update(attendanceDays)
        .set({
          status: "present",
          source: existing.source === "manual" ? "manual" : "system",
          checkInAt,
          checkOutAt,
          isLate,
          isEarlyLeave,
          isMissedCheckout: false,
          updatedAt: now,
        })
        .where(eq(attendanceDays.id, existing.id));

      updated += 1;
      details.push(`${entry.employeeCode}: updated`);
      continue;
    }

    await db.insert(attendanceDays).values({
      employeeId,
      shiftDate,
      status: "present",
      source: "system",
      checkInAt,
      checkOutAt,
      isLate,
      isEarlyLeave,
      isMissedCheckout: false,
      totalBreakSeconds: 0,
    });

    created += 1;
    details.push(`${entry.employeeCode}: created`);
  }

  return { created, updated, skipped, details };
}

/** Xorora device check-ins for shift date 2026-07-09 (times in PKT). */
export const XORORA_2026_07_09_BACKFILL: BackfillShiftEntry[] = [
  { employeeCode: "010", checkInPkt: "13:12", checkOutPkt: "22:01" },
  { employeeCode: "001", checkInPkt: "18:00" },
  { employeeCode: "002", checkInPkt: "18:03" },
  { employeeCode: "004", checkInPkt: "17:55" },
  { employeeCode: "005", checkInPkt: "18:00" },
  { employeeCode: "007", checkInPkt: "18:03" },
  { employeeCode: "024", checkInPkt: "17:56" },
];
