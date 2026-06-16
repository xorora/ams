import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, employees } from "@/db/schema";
import { isWeekendDate } from "@/lib/leave/working-days";
import { shouldAutoMarkAbsent, shouldAutoMarkWeekendOff } from "./mark-absent-eligibility";
import {
  type MarkMissedCheckoutJobResult,
  runMarkMissedCheckoutJob,
} from "./mark-missed-checkout-job";
import { getAutoAbsentShiftDate } from "./rules";

export type MarkAbsentJobResult = {
  shiftDate: string;
  marked: number;
  skipped: number;
  totalActive: number;
  kind: "absent" | "weekend_off";
  missedCheckout: MarkMissedCheckoutJobResult;
};

const weekendOffRowValues = {
  status: "weekend_off" as const,
  source: "system" as const,
  checkInAt: null,
  checkOutAt: null,
  checkInLat: null,
  checkInLng: null,
  checkOutLat: null,
  checkOutLng: null,
  isLate: false,
  isEarlyLeave: false,
  isMissedCheckout: false,
  totalBreakSeconds: 0,
};

const absentRowValues = {
  status: "absent" as const,
  source: "system" as const,
  checkInAt: null,
  checkOutAt: null,
  checkInLat: null,
  checkInLng: null,
  checkOutLat: null,
  checkOutLng: null,
  isLate: false,
  isEarlyLeave: false,
  isMissedCheckout: false,
  totalBreakSeconds: 0,
};

export async function runMarkAbsentJob(runAt: Date = new Date()): Promise<MarkAbsentJobResult> {
  const missedCheckout = await runMarkMissedCheckoutJob(runAt);
  const shiftDate = getAutoAbsentShiftDate(runAt);
  const now = runAt;
  const isWeekend = isWeekendDate(shiftDate);

  const activeEmployees = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.isActive, true));

  const existingDays = await db
    .select({
      id: attendanceDays.id,
      employeeId: attendanceDays.employeeId,
      checkInAt: attendanceDays.checkInAt,
      status: attendanceDays.status,
      source: attendanceDays.source,
    })
    .from(attendanceDays)
    .where(eq(attendanceDays.shiftDate, shiftDate));

  const dayByEmployee = new Map(existingDays.map((d) => [d.employeeId, d]));

  let marked = 0;
  let skipped = 0;

  for (const { id: employeeId } of activeEmployees) {
    const day = dayByEmployee.get(employeeId) ?? null;
    const shouldMark = isWeekend ? shouldAutoMarkWeekendOff(day) : shouldAutoMarkAbsent(day);

    if (!shouldMark) {
      skipped += 1;
      continue;
    }

    const rowValues = isWeekend ? weekendOffRowValues : absentRowValues;

    if (day) {
      await db
        .update(attendanceDays)
        .set({
          ...rowValues,
          updatedAt: now,
        })
        .where(eq(attendanceDays.id, day.id));
    } else {
      await db.insert(attendanceDays).values({
        employeeId,
        shiftDate,
        ...rowValues,
      });
    }

    marked += 1;
  }

  return {
    shiftDate,
    marked,
    skipped,
    totalActive: activeEmployees.length,
    kind: isWeekend ? "weekend_off" : "absent",
    missedCheckout,
  };
}
