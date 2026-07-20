import { and, eq, gte, lte } from "drizzle-orm";
import { formatInTimeZone } from "date-fns-tz";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { attendanceDays, companies, employees } from "@/db/schema";
import { assignLateFinesByShiftDate } from "@/lib/attendance/late-fines-utils";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { effectiveAttendanceStatus } from "@/lib/attendance/effective-status";

export const maxDuration = 60;

const OPS_ONE_SHOT_TOKEN = "ams-ops-employee-july-report-k2m9";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  const token = url.searchParams.get("token");
  if (auth !== `Bearer ${OPS_ONE_SHOT_TOKEN}` && token !== OPS_ONE_SHOT_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const code = url.searchParams.get("code") ?? "002";

  const [xorora] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, "xorora"))
    .limit(1);

  const [employee] = await db
    .select({
      id: employees.id,
      code: employees.employeeCode,
      name: employees.fullName,
      preset: employees.shiftPreset,
    })
    .from(employees)
    .where(and(eq(employees.companyId, xorora!.id), eq(employees.employeeCode, code)))
    .limit(1);

  if (!employee) {
    return NextResponse.json({ error: "employee not found" }, { status: 404 });
  }

  const days = await db
    .select({
      shiftDate: attendanceDays.shiftDate,
      status: attendanceDays.status,
      checkInAt: attendanceDays.checkInAt,
      checkOutAt: attendanceDays.checkOutAt,
      isLate: attendanceDays.isLate,
      isMissedCheckout: attendanceDays.isMissedCheckout,
      notes: attendanceDays.notes,
      source: attendanceDays.source,
    })
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, employee.id),
        gte(attendanceDays.shiftDate, "2026-07-01"),
        lte(attendanceDays.shiftDate, "2026-07-20"),
      ),
    )
    .orderBy(attendanceDays.shiftDate);

  const fineMap = assignLateFinesByShiftDate(
    days.map((day) => ({ shiftDate: day.shiftDate, isLate: day.isLate })),
  );

  return NextResponse.json({
    ok: true,
    employee,
    days: days.map((day) => ({
      shiftDate: day.shiftDate,
      status: effectiveAttendanceStatus(day),
      checkInPkt: day.checkInAt
        ? formatInTimeZone(day.checkInAt, BUSINESS_TIMEZONE, "yyyy-MM-dd h:mm a")
        : null,
      checkOutPkt: day.checkOutAt
        ? formatInTimeZone(day.checkOutAt, BUSINESS_TIMEZONE, "yyyy-MM-dd h:mm a")
        : null,
      isLate: day.isLate,
      lateFinePkr: fineMap.get(day.shiftDate) ?? 0,
      isMissedCheckout: day.isMissedCheckout,
      source: day.source,
      notes: day.notes,
    })),
  });
}
