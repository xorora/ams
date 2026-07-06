import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attendanceDays, breakSessions, employees } from "@/db/schema";
import { isWeekendDate } from "@/lib/leave/working-days";
import {
  getCompanyShiftConfig,
  getShiftDateForCompany,
  getShiftScheduleLabels,
  isEarlyLeaveForCompany,
  type CompanyShiftConfig,
} from "./company-shift";
import { findOpenShift } from "./close-open-shift";
import type { Coordinates } from "./coords";
import {
  getEmployeeCompanySlug,
  requireActiveEmployee,
  requireWithinGeofence,
} from "./employee-access";
import {
  buildLateCheckInMessage,
  countMonthlyLatesBeforeCheckIn,
  getEmployeeMonthlyLateSummary,
} from "./late-fines";
import {
  type BreakSessionInput,
  canEndBreak,
  canStartBreak,
  computeTotalBreakSeconds,
  getActiveBreak,
} from "./rules";
import {
  type AttendanceDaySnapshot,
  buildTodayStatus,
  lateFlagForCheckIn,
  type TodayStatusPayload,
} from "./status";

export type ServiceFailure = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type ServiceSuccess<T> = { ok: true; data: T };

function failure(status: number, code: string, message: string): ServiceFailure {
  return { ok: false, status, code, message };
}

function weekendOffFailure(): ServiceFailure {
  return failure(403, "WEEKEND_OFF", "The office is closed on weekends (Saturday and Sunday).");
}

function toDaySnapshot(row: typeof attendanceDays.$inferSelect): AttendanceDaySnapshot {
  return {
    id: row.id,
    shiftDate: row.shiftDate,
    status: row.status,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    isLate: row.isLate,
    isEarlyLeave: row.isEarlyLeave,
    isMissedCheckout: row.isMissedCheckout,
    totalBreakSeconds: row.totalBreakSeconds,
  };
}

async function loadShiftAttendance(employeeId: string, shiftDate: string) {
  const [day] = await db
    .select()
    .from(attendanceDays)
    .where(and(eq(attendanceDays.employeeId, employeeId), eq(attendanceDays.shiftDate, shiftDate)))
    .limit(1);

  if (!day) {
    return { day: null, sessions: [] as BreakSessionInput[] };
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

  return { day: toDaySnapshot(day), sessions: breakInputs };
}

type ShiftAttendanceContext = {
  day: AttendanceDaySnapshot | null;
  sessions: BreakSessionInput[];
  shiftConfig: CompanyShiftConfig;
  shiftDate: string;
};

/** Resolves the shift day the employee is on, including open shifts from prior shift dates. */
async function resolveShiftAttendance(
  employeeId: string,
  now: Date,
): Promise<ShiftAttendanceContext> {
  const shiftConfig = await loadEmployeeShiftConfig(employeeId);
  const calendarShiftDate = getShiftDateForCompany(now, shiftConfig);
  const openShift = await findOpenShift(employeeId);
  const shiftDate = openShift?.shiftDate ?? calendarShiftDate;
  const { day, sessions } = await loadShiftAttendance(employeeId, shiftDate);

  return { day, sessions, shiftConfig, shiftDate };
}

async function guardEmployeeAndGeofence(
  employeeId: string,
  coords: Coordinates,
): Promise<
  ServiceFailure | ServiceSuccess<{ employee: typeof import("@/db/schema").employees.$inferSelect }>
> {
  const employeeResult = await requireActiveEmployee(employeeId);
  if (!employeeResult.ok) {
    return failure(employeeResult.status, employeeResult.code, employeeResult.message);
  }

  const geofenceResult = await requireWithinGeofence(coords);
  if (!geofenceResult.ok) {
    return failure(geofenceResult.status, geofenceResult.code, geofenceResult.message);
  }

  return { ok: true, data: { employee: employeeResult.employee } };
}

async function loadEmployeeShiftConfig(employeeId: string) {
  const companySlug = await getEmployeeCompanySlug(employeeId);
  return getCompanyShiftConfig(companySlug ?? "xorora");
}

export async function getTodayStatus(
  employeeId: string,
): Promise<ServiceSuccess<TodayStatusPayload>> {
  const now = new Date();
  const { day, sessions, shiftConfig, shiftDate } = await resolveShiftAttendance(employeeId, now);
  const monthlyLate = await getEmployeeMonthlyLateSummary(employeeId, shiftDate, {
    includeTodayLate: true,
  });
  const status = buildTodayStatus(day, sessions, monthlyLate, shiftConfig, now);

  const [employee] = await db
    .select({ isActive: employees.isActive })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);

  if (employee && !employee.isActive) {
    return {
      ok: true,
      data: {
        ...status,
        employeeInactive: true,
        actions: {
          canCheckIn: false,
          canCheckOut: false,
          canStartBreak: false,
          canEndBreak: false,
        },
      },
    };
  }

  return { ok: true, data: status };
}

export async function checkIn(
  employeeId: string,
  coords: Coordinates,
): Promise<ServiceFailure | ServiceSuccess<{ message: string; status: TodayStatusPayload }>> {
  const guard = await guardEmployeeAndGeofence(employeeId, coords);
  if (!guard.ok) {
    return guard;
  }

  const now = new Date();
  const shiftConfig = await loadEmployeeShiftConfig(employeeId);
  const shiftDate = getShiftDateForCompany(now, shiftConfig);
  if (isWeekendDate(shiftDate)) {
    return weekendOffFailure();
  }

  const openShift = await findOpenShift(employeeId);
  if (openShift && openShift.shiftDate !== shiftDate) {
    return failure(
      409,
      "OPEN_SHIFT",
      `You still have an open shift for ${openShift.shiftDate}. Check out before starting a new shift.`,
    );
  }

  const { day } = await loadShiftAttendance(employeeId, shiftDate);

  if (day?.checkInAt || (day?.status === "present" && !day?.checkOutAt)) {
    return failure(409, "ALREADY_CHECKED_IN", "You have already checked in for this shift.");
  }

  if (day?.checkOutAt) {
    return failure(409, "SHIFT_COMPLETE", "This shift is already complete.");
  }

  const isLate = lateFlagForCheckIn(now, shiftDate, shiftConfig);
  const priorMonthlyLates = isLate
    ? await countMonthlyLatesBeforeCheckIn(employeeId, shiftDate)
    : 0;

  if (day) {
    await db
      .update(attendanceDays)
      .set({
        status: "present",
        source: "auto",
        checkInAt: now,
        checkInLat: coords.lat,
        checkInLng: coords.lng,
        isLate,
        updatedAt: now,
      })
      .where(eq(attendanceDays.id, day.id));
  } else {
    await db.insert(attendanceDays).values({
      employeeId,
      shiftDate,
      status: "present",
      source: "auto",
      checkInAt: now,
      checkInLat: coords.lat,
      checkInLng: coords.lng,
      isLate,
    });
  }

  const status = await getTodayStatus(employeeId);
  const message = buildLateCheckInMessage(priorMonthlyLates, isLate);

  return { ok: true, data: { message, status: status.data } };
}

export async function checkOut(
  employeeId: string,
  coords: Coordinates,
  options?: { confirmEarlyLeave?: boolean },
): Promise<ServiceFailure | ServiceSuccess<{ message: string; status: TodayStatusPayload }>> {
  const guard = await guardEmployeeAndGeofence(employeeId, coords);
  if (!guard.ok) {
    return guard;
  }

  const now = new Date();
  const { day, sessions, shiftConfig } = await resolveShiftAttendance(employeeId, now);
  const shiftSchedule = getShiftScheduleLabels(shiftConfig);

  if (!day?.checkInAt && day?.status !== "present") {
    return failure(400, "NOT_CHECKED_IN", "Check in before checking out.");
  }

  if (day.checkOutAt) {
    return failure(409, "ALREADY_CHECKED_OUT", "You have already checked out for this shift.");
  }

  if (getActiveBreak(sessions)) {
    return failure(400, "BREAK_ACTIVE", "End your break before checking out.");
  }

  const early = isEarlyLeaveForCompany(now, day.shiftDate, shiftConfig);
  if (early && !options?.confirmEarlyLeave) {
    return failure(
      409,
      "EARLY_LEAVE_CONFIRM_REQUIRED",
      `Checking out now is before ${shiftSchedule.expectedCheckOutTime} and will be marked as early leave. Confirm to proceed.`,
    );
  }

  await db
    .update(attendanceDays)
    .set({
      checkOutAt: now,
      checkOutLat: coords.lat,
      checkOutLng: coords.lng,
      isEarlyLeave: early,
      isMissedCheckout: false,
      updatedAt: now,
    })
    .where(eq(attendanceDays.id, day.id));

  const status = await getTodayStatus(employeeId);
  const message = early
    ? `Checked out. Early leave recorded (before ${shiftSchedule.expectedCheckOutTime}).`
    : "Checked out successfully.";

  return { ok: true, data: { message, status: status.data } };
}

export async function startBreak(
  employeeId: string,
  coords: Coordinates,
): Promise<ServiceFailure | ServiceSuccess<{ message: string; status: TodayStatusPayload }>> {
  const guard = await guardEmployeeAndGeofence(employeeId, coords);
  if (!guard.ok) {
    return guard;
  }

  const now = new Date();
  const { day, sessions } = await resolveShiftAttendance(employeeId, now);

  if (!day?.checkInAt && day?.status !== "present") {
    return failure(400, "NOT_CHECKED_IN", "Check in before starting a break.");
  }

  if (day.checkOutAt) {
    return failure(409, "SHIFT_COMPLETE", "You have already checked out for this shift.");
  }

  const rule = canStartBreak(sessions, now);
  if (!rule.ok) {
    return failure(400, rule.code, rule.message);
  }

  await db.insert(breakSessions).values({
    attendanceDayId: day.id,
    startedAt: now,
  });

  const status = await getTodayStatus(employeeId);
  return { ok: true, data: { message: "Break started.", status: status.data } };
}

export async function endBreak(
  employeeId: string,
  coords: Coordinates,
): Promise<ServiceFailure | ServiceSuccess<{ message: string; status: TodayStatusPayload }>> {
  const guard = await guardEmployeeAndGeofence(employeeId, coords);
  if (!guard.ok) {
    return guard;
  }

  const now = new Date();
  const { day, sessions } = await resolveShiftAttendance(employeeId, now);

  if (!day?.checkInAt && day?.status !== "present") {
    return failure(400, "NOT_CHECKED_IN", "Check in before ending a break.");
  }

  if (day.checkOutAt) {
    return failure(409, "SHIFT_COMPLETE", "You have already checked out for this shift.");
  }

  const rule = canEndBreak(sessions, now);
  if (!rule.ok) {
    return failure(400, rule.code, rule.message);
  }

  const active = getActiveBreak(sessions);
  if (!active) {
    return failure(400, "NO_ACTIVE_BREAK", "No active break to end.");
  }

  const [activeRow] = await db
    .select()
    .from(breakSessions)
    .where(and(eq(breakSessions.attendanceDayId, day.id), isNull(breakSessions.endedAt)))
    .limit(1);

  if (!activeRow) {
    return failure(400, "NO_ACTIVE_BREAK", "No active break to end.");
  }

  const durationSeconds = Math.max(
    0,
    Math.floor((now.getTime() - activeRow.startedAt.getTime()) / 1000),
  );

  await db
    .update(breakSessions)
    .set({
      endedAt: now,
      durationSeconds,
    })
    .where(eq(breakSessions.id, activeRow.id));

  const updatedSessions: BreakSessionInput[] = sessions.map((s) =>
    s.startedAt.getTime() === activeRow.startedAt.getTime() && s.endedAt == null
      ? { startedAt: s.startedAt, endedAt: now, durationSeconds }
      : s,
  );
  const totalBreakSeconds = computeTotalBreakSeconds(updatedSessions, now);

  await db
    .update(attendanceDays)
    .set({
      totalBreakSeconds,
      updatedAt: now,
    })
    .where(eq(attendanceDays.id, day.id));

  const status = await getTodayStatus(employeeId);
  return { ok: true, data: { message: "Break ended.", status: status.data } };
}
