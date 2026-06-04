import { eq } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, employees } from "@/db/schema";
import { shouldAutoMarkAbsent } from "./mark-absent-eligibility";
import { getAutoAbsentShiftDate } from "./rules";

export type MarkAbsentJobResult = {
  shiftDate: string;
  marked: number;
  skipped: number;
  totalActive: number;
};

export async function runMarkAbsentJob(runAt: Date = new Date()): Promise<MarkAbsentJobResult> {
  const shiftDate = getAutoAbsentShiftDate(runAt);
  const now = runAt;

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
    if (!shouldAutoMarkAbsent(day)) {
      skipped += 1;
      continue;
    }

    if (day) {
      await db
        .update(attendanceDays)
        .set({
          status: "absent",
          source: "system",
          checkInAt: null,
          checkOutAt: null,
          checkInLat: null,
          checkInLng: null,
          checkOutLat: null,
          checkOutLng: null,
          isLate: false,
          isEarlyLeave: false,
          totalBreakSeconds: 0,
          updatedAt: now,
        })
        .where(eq(attendanceDays.id, day.id));
    } else {
      await db.insert(attendanceDays).values({
        employeeId,
        shiftDate,
        status: "absent",
        source: "system",
      });
    }

    marked += 1;
  }

  return {
    shiftDate,
    marked,
    skipped,
    totalActive: activeEmployees.length,
  };
}
