import { addDays, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  BUSINESS_TIMEZONE,
  EXPECTED_CHECK_OUT_HOUR,
  EXPECTED_CHECK_OUT_MINUTE,
  LATE_CHECK_IN_HOUR,
  LATE_CHECK_IN_MINUTE,
  MAX_BREAK_SECONDS,
  SHIFT_DATE_NOON_BOUNDARY_HOUR,
} from "./constants";

export type BreakSessionInput = {
  startedAt: Date;
  endedAt: Date | null;
  durationSeconds: number | null;
};

export type RuleResult = { ok: true } | { ok: false; code: string; message: string };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Build a UTC instant for a clock time on a calendar date in PKT. */
export function zonedTimeOnShiftDate(
  shiftDate: string,
  time: { hour: number; minute?: number; second?: number },
): Date {
  const { hour, minute = 0, second = 0 } = time;
  const local = `${shiftDate} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
  return fromZonedTime(local, BUSINESS_TIMEZONE);
}

function shiftDateAddDays(shiftDate: string, days: number): string {
  const anchor = fromZonedTime(`${shiftDate} 12:00:00`, BUSINESS_TIMEZONE);
  const shifted = days >= 0 ? addDays(anchor, days) : subDays(anchor, Math.abs(days));
  return formatInTimeZone(shifted, BUSINESS_TIMEZONE, "yyyy-MM-dd");
}

/**
 * Attendance day keyed by shift start date (6 PM check-in calendar date in PKT).
 * From local noon onward, use that calendar date; before noon, use the previous day.
 */
export function getShiftDate(at: Date): string {
  const hour = Number(formatInTimeZone(at, BUSINESS_TIMEZONE, "H"));
  const calendarDate = formatInTimeZone(at, BUSINESS_TIMEZONE, "yyyy-MM-dd");
  if (hour >= SHIFT_DATE_NOON_BOUNDARY_HOUR) {
    return calendarDate;
  }
  return shiftDateAddDays(calendarDate, -1);
}

/** 18:30 PKT on the shift start date — last on-time check-in. */
export function getLateCheckInDeadline(shiftDate: string): Date {
  return zonedTimeOnShiftDate(shiftDate, {
    hour: LATE_CHECK_IN_HOUR,
    minute: LATE_CHECK_IN_MINUTE,
    second: 0,
  });
}

/** 03:00 PKT on the morning after the shift start date — expected check-out. */
export function getExpectedCheckOutAt(shiftDate: string): Date {
  const nextDay = shiftDateAddDays(shiftDate, 1);
  return zonedTimeOnShiftDate(nextDay, {
    hour: EXPECTED_CHECK_OUT_HOUR,
    minute: EXPECTED_CHECK_OUT_MINUTE,
    second: 0,
  });
}

/** Late when check-in is strictly after 18:30 PKT on the shift date. */
export function isLateCheckIn(checkInAt: Date, shiftDate: string): boolean {
  return checkInAt.getTime() > getLateCheckInDeadline(shiftDate).getTime();
}

/** Early leave when check-out is strictly before 03:00 PKT the morning after shift date. */
export function isEarlyLeave(checkOutAt: Date, shiftDate: string): boolean {
  return checkOutAt.getTime() < getExpectedCheckOutAt(shiftDate).getTime();
}

/**
 * Shift date to mark absent when cron runs (~04:00 PKT).
 * At that hour the active shift date is the completed night shift (yesterday's start).
 */
export function getAutoAbsentShiftDate(runAt: Date): string {
  return getShiftDate(runAt);
}

function breakDurationSeconds(session: BreakSessionInput, now: Date): number {
  if (session.endedAt) {
    if (session.durationSeconds != null) {
      return session.durationSeconds;
    }
    return Math.max(
      0,
      Math.floor((session.endedAt.getTime() - session.startedAt.getTime()) / 1000),
    );
  }
  return Math.max(0, Math.floor((now.getTime() - session.startedAt.getTime()) / 1000));
}

export function getActiveBreak(sessions: BreakSessionInput[]): BreakSessionInput | undefined {
  return sessions.find((s) => s.endedAt == null);
}

/** Sum of ended breaks plus elapsed time on any open break. */
export function computeTotalBreakSeconds(
  sessions: BreakSessionInput[],
  now: Date = new Date(),
): number {
  return sessions.reduce((sum, session) => sum + breakDurationSeconds(session, now), 0);
}

/** Net working time from check-in to check-out (or now), excluding breaks. */
export function computeElapsedShiftSeconds(
  checkInAt: Date | null | undefined,
  checkOutAt: Date | null | undefined,
  totalBreakSeconds: number,
  now: Date = new Date(),
): number | null {
  if (!checkInAt) {
    return null;
  }
  const end = checkOutAt ?? now;
  const grossSeconds = Math.max(0, Math.floor((end.getTime() - checkInAt.getTime()) / 1000));
  return Math.max(0, grossSeconds - totalBreakSeconds);
}

export function canStartBreak(sessions: BreakSessionInput[], now: Date = new Date()): RuleResult {
  if (getActiveBreak(sessions)) {
    return {
      ok: false,
      code: "BREAK_ALREADY_ACTIVE",
      message: "End your current break before starting another.",
    };
  }
  const total = computeTotalBreakSeconds(sessions, now);
  if (total >= MAX_BREAK_SECONDS) {
    return {
      ok: false,
      code: "BREAK_CAP_REACHED",
      message: "You have used the maximum break time for this shift (60 minutes).",
    };
  }
  return { ok: true };
}

export function canEndBreak(sessions: BreakSessionInput[], now: Date = new Date()): RuleResult {
  const active = getActiveBreak(sessions);
  if (!active) {
    return { ok: false, code: "NO_ACTIVE_BREAK", message: "No active break to end." };
  }
  const completed = sessions
    .filter((s) => s.endedAt != null)
    .reduce((sum, s) => sum + breakDurationSeconds(s, now), 0);
  const activeSeconds = Math.max(
    0,
    Math.floor((now.getTime() - active.startedAt.getTime()) / 1000),
  );
  if (completed + activeSeconds > MAX_BREAK_SECONDS) {
    return {
      ok: false,
      code: "BREAK_CAP_EXCEEDED",
      message: "Ending this break would exceed the 60-minute limit for the shift.",
    };
  }
  return { ok: true };
}
