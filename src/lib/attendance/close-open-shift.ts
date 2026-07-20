import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, breakSessions, employees } from "@/db/schema";
import { isActiveShiftWindow } from "./company-shift";
import { loadEmployeeShiftConfig } from "./employee-shift";
import {
  type BreakSessionInput,
  computeTotalBreakSeconds,
  getActiveBreak,
  isEarlyLeave,
} from "./rules";

export type OpenShiftState = "checked_in" | "on_break";

export type OpenShiftInfo = {
  attendanceDayId: string;
  shiftDate: string;
  checkInAt: Date | null;
  state: OpenShiftState;
};

export async function findOpenShift(employeeId: string): Promise<OpenShiftInfo | null> {
  const [day] = await db
    .select()
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, employeeId),
        isNull(attendanceDays.checkOutAt),
        or(isNotNull(attendanceDays.checkInAt), eq(attendanceDays.status, "present")),
      ),
    )
    .orderBy(desc(attendanceDays.shiftDate))
    .limit(1);

  if (!day || (!day.checkInAt && day.status !== "present")) {
    return null;
  }

  const sessions = await db
    .select()
    .from(breakSessions)
    .where(eq(breakSessions.attendanceDayId, day.id));

  const breakInputs: BreakSessionInput[] = sessions.map((s) => ({
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationSeconds: s.durationSeconds,
  }));

  return {
    attendanceDayId: day.id,
    shiftDate: day.shiftDate,
    checkInAt: day.checkInAt,
    state: getActiveBreak(breakInputs) ? "on_break" : "checked_in",
  };
}

/** Open shift that is still within the active check-out window for the employee's company. */
export async function findActiveOpenShift(
  employeeId: string,
  now: Date = new Date(),
): Promise<OpenShiftInfo | null> {
  const open = await findOpenShift(employeeId);
  if (!open) {
    return null;
  }

  const config = await loadEmployeeShiftConfig(employeeId);
  if (!isActiveShiftWindow(open.shiftDate, now, config)) {
    return null;
  }

  return open;
}

const DEACTIVATION_NOTE = "Shift closed on employee deactivation.";

function appendDeactivationNote(existing: string | null): string {
  if (!existing?.trim()) {
    return DEACTIVATION_NOTE;
  }
  if (existing.includes(DEACTIVATION_NOTE)) {
    return existing;
  }
  return `${existing.trim()}\n${DEACTIVATION_NOTE}`;
}

/** Ends any active break and checks out an open shift (system/admin action). */
export async function closeOpenShiftForEmployee(
  employeeId: string,
  at: Date = new Date(),
): Promise<{ closed: boolean; attendanceDayId: string | null }> {
  const open = await findOpenShift(employeeId);
  if (!open) {
    return { closed: false, attendanceDayId: null };
  }

  const [day] = await db
    .select()
    .from(attendanceDays)
    .where(eq(attendanceDays.id, open.attendanceDayId))
    .limit(1);

  if (!day || day.checkOutAt) {
    return { closed: false, attendanceDayId: null };
  }
  if (!day.checkInAt && day.status !== "present") {
    return { closed: false, attendanceDayId: null };
  }

  const sessions = await db
    .select()
    .from(breakSessions)
    .where(eq(breakSessions.attendanceDayId, day.id));

  const breakInputs: BreakSessionInput[] = sessions.map((s) => ({
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationSeconds: s.durationSeconds,
  }));

  const [activeRow] = await db
    .select()
    .from(breakSessions)
    .where(and(eq(breakSessions.attendanceDayId, day.id), isNull(breakSessions.endedAt)))
    .limit(1);

  let updatedSessions = breakInputs;

  if (activeRow) {
    const durationSeconds = Math.max(
      0,
      Math.floor((at.getTime() - activeRow.startedAt.getTime()) / 1000),
    );

    await db
      .update(breakSessions)
      .set({
        endedAt: at,
        durationSeconds,
      })
      .where(eq(breakSessions.id, activeRow.id));

    updatedSessions = breakInputs.map((s) =>
      s.startedAt.getTime() === activeRow.startedAt.getTime() && s.endedAt == null
        ? { startedAt: s.startedAt, endedAt: at, durationSeconds }
        : s,
    );
  }

  const totalBreakSeconds = computeTotalBreakSeconds(updatedSessions, at);
  const early = isEarlyLeave(at, day.shiftDate);

  await db
    .update(attendanceDays)
    .set({
      checkOutAt: at,
      checkOutLat: null,
      checkOutLng: null,
      isEarlyLeave: early,
      totalBreakSeconds,
      notes: appendDeactivationNote(day.notes),
      updatedAt: at,
    })
    .where(eq(attendanceDays.id, day.id));

  return { closed: true, attendanceDayId: day.id };
}
