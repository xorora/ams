import { and, eq, gte, lte } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import {
  XORORA_EVENING_SHIFT,
  getLateCheckInDeadline,
  getShiftConfigForEmployee,
  isLateCheckInForCompany,
} from "@/lib/attendance/company-shift";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export const maxDuration = 60;

const OPS_ONE_SHOT_TOKEN = "ams-ops-list-jul-lates-w4n8";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  const token = url.searchParams.get("token");
  if (auth !== `Bearer ${OPS_ONE_SHOT_TOKEN}` && token !== OPS_ONE_SHOT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [xorora] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, "xorora"))
    .limit(1);

  const lateRows = await db
    .select({
      code: employees.employeeCode,
      name: employees.fullName,
      preset: employees.shiftPreset,
      shiftDate: attendanceDays.shiftDate,
      isLate: attendanceDays.isLate,
      checkInAt: attendanceDays.checkInAt,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(attendanceDays.employeeId, employees.id))
    .where(
      and(
        eq(employees.companyId, xorora!.id),
        gte(attendanceDays.shiftDate, "2026-07-01"),
        lte(attendanceDays.shiftDate, "2026-07-20"),
        eq(attendanceDays.isLate, true),
      ),
    )
    .orderBy(attendanceDays.shiftDate);

  const rows = lateRows.map((row) => {
    const checkInPkt = row.checkInAt
      ? formatInTimeZone(row.checkInAt, BUSINESS_TIMEZONE, "HH:mm:ss")
      : null;
    const config = getShiftConfigForEmployee("xorora", row.preset, row.name, row.shiftDate);
    const eveningLate = row.checkInAt
      ? isLateCheckInForCompany(row.checkInAt, row.shiftDate, XORORA_EVENING_SHIFT)
      : null;
    const configLate = row.checkInAt
      ? isLateCheckInForCompany(row.checkInAt, row.shiftDate, config)
      : null;
    return {
      code: row.code,
      name: row.name,
      preset: row.preset,
      shiftDate: row.shiftDate,
      checkInPkt,
      eveningDeadline: formatInTimeZone(
        getLateCheckInDeadline(row.shiftDate, XORORA_EVENING_SHIFT),
        BUSINESS_TIMEZONE,
        "HH:mm:ss",
      ),
      eveningLate,
      configLate,
    };
  });

  return NextResponse.json({ ok: true, count: rows.length, rows });
}
