import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIMEZONE, MAX_BREAK_SECONDS } from "./constants";
import {
  type BreakSessionInput,
  canEndBreak,
  canStartBreak,
  computeTotalBreakSeconds,
  getActiveBreak,
  getShiftDate,
  isEarlyLeave,
  isLateCheckIn,
} from "./rules";

export type WorkState = "not_checked_in" | "checked_in" | "on_break" | "checked_out";

export type AttendanceDaySnapshot = {
  id: string;
  shiftDate: string;
  status: string;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  isLate: boolean;
  isEarlyLeave: boolean;
  totalBreakSeconds: number;
};

export type TodayStatusPayload = {
  pktNow: string;
  shiftDate: string;
  state: WorkState;
  attendanceDay: AttendanceDaySnapshot | null;
  breakSessions: BreakSessionInput[];
  totalBreakSeconds: number;
  breakRemainingSeconds: number;
  activeBreakStartedAt: string | null;
  wouldBeEarlyLeave: boolean;
  warnings: string[];
  actions: {
    canCheckIn: boolean;
    canCheckOut: boolean;
    canStartBreak: boolean;
    canEndBreak: boolean;
  };
};

function deriveWorkState(
  day: AttendanceDaySnapshot | null,
  activeBreak: BreakSessionInput | undefined,
): WorkState {
  if (!day?.checkInAt) {
    return "not_checked_in";
  }
  if (day.checkOutAt) {
    return "checked_out";
  }
  if (activeBreak) {
    return "on_break";
  }
  return "checked_in";
}

export function buildTodayStatus(
  day: AttendanceDaySnapshot | null,
  breakSessions: BreakSessionInput[],
  now: Date = new Date(),
): TodayStatusPayload {
  const shiftDate = getShiftDate(now);
  const activeBreak = getActiveBreak(breakSessions);
  const state = deriveWorkState(day, activeBreak);
  const totalBreakSeconds = computeTotalBreakSeconds(breakSessions, now);
  const breakRemainingSeconds = Math.max(0, MAX_BREAK_SECONDS - totalBreakSeconds);

  const wouldBeEarlyLeave =
    day?.checkInAt != null && day.checkOutAt == null && isEarlyLeave(now, day.shiftDate);

  const warnings: string[] = [];
  if (day?.isLate) {
    warnings.push("You checked in late (after 18:30 PKT).");
  }
  if (day?.isEarlyLeave) {
    warnings.push("You checked out early (before 03:00 PKT).");
  }
  if (wouldBeEarlyLeave && state !== "checked_out") {
    warnings.push("Checking out now would be marked as early leave (before 03:00 PKT).");
  }
  if (breakRemainingSeconds <= 0 && state !== "checked_out") {
    warnings.push("You have used the full 60-minute break allowance for this shift.");
  } else if (breakRemainingSeconds > 0 && breakRemainingSeconds <= 300 && state !== "checked_out") {
    warnings.push(
      `About ${Math.ceil(breakRemainingSeconds / 60)} minutes of break time remaining.`,
    );
  }

  const hasOpenShift = day?.checkInAt != null && day.checkOutAt == null;
  const startBreakResult = canStartBreak(breakSessions, now);
  const endBreakResult = canEndBreak(breakSessions, now);

  return {
    pktNow: formatInTimeZone(now, BUSINESS_TIMEZONE, "yyyy-MM-dd HH:mm:ss"),
    shiftDate,
    state,
    attendanceDay: day,
    breakSessions,
    totalBreakSeconds,
    breakRemainingSeconds,
    activeBreakStartedAt: activeBreak ? activeBreak.startedAt.toISOString() : null,
    wouldBeEarlyLeave,
    warnings,
    actions: {
      canCheckIn: !day?.checkInAt,
      canCheckOut: hasOpenShift && !activeBreak,
      canStartBreak: hasOpenShift && startBreakResult.ok,
      canEndBreak: hasOpenShift && endBreakResult.ok,
    },
  };
}

export function lateFlagForCheckIn(checkInAt: Date, shiftDate: string): boolean {
  return isLateCheckIn(checkInAt, shiftDate);
}
