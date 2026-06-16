import { formatInTimeZone } from "date-fns-tz";
import { PKT_DATETIME_12H_FORMAT } from "@/lib/admin/display";
import { isWeekendDate } from "@/lib/leave/working-days";
import {
  BUSINESS_TIMEZONE,
  EXPECTED_CHECK_OUT_TIME_PKT,
  formatLateCheckInDeadline,
  formatLateCheckOutDeadline,
  MAX_BREAK_SECONDS,
} from "./constants";
import { buildMonthlyLateWarnings, type MonthlyLateSummary } from "./late-fines";
import { computeOvertimeSnapshot, type OvertimeSnapshot } from "./overtime";
import {
  type BreakSessionInput,
  canEndBreak,
  canStartBreak,
  computeElapsedShiftSeconds,
  computeTotalBreakSeconds,
  getActiveBreak,
  getExpectedCheckOutAt,
  getShiftDate,
  isEarlyLeave,
  isLateCheckIn,
  isPastMissedCheckOutDeadline,
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
  isMissedCheckout: boolean;
  overtimeStartedAt: Date | null;
  overtimeEndedAt: Date | null;
  overtimeSeconds: number | null;
  totalBreakSeconds: number;
};

export type TodayStatusPayload = {
  pktNow: string;
  shiftDate: string;
  state: WorkState;
  isWeekendOff: boolean;
  employeeInactive: boolean;
  attendanceDay: AttendanceDaySnapshot | null;
  breakSessions: BreakSessionInput[];
  totalBreakSeconds: number;
  breakRemainingSeconds: number;
  elapsedShiftSeconds: number | null;
  overtime: OvertimeSnapshot;
  statusAt: string;
  activeBreakStartedAt: string | null;
  wouldBeEarlyLeave: boolean;
  monthlyLate: MonthlyLateSummary;
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
  if (day.checkOutAt || day.isMissedCheckout) {
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
  monthlyLate: MonthlyLateSummary,
  now: Date = new Date(),
): TodayStatusPayload {
  const shiftDate = getShiftDate(now);
  const isWeekendOff = isWeekendDate(shiftDate);
  const activeBreak = getActiveBreak(breakSessions);
  const state = deriveWorkState(day, activeBreak);
  const totalBreakSeconds = computeTotalBreakSeconds(breakSessions, now);
  const breakRemainingSeconds = Math.max(0, MAX_BREAK_SECONDS - totalBreakSeconds);
  const elapsedShiftSeconds = computeElapsedShiftSeconds(
    day?.checkInAt,
    day?.checkOutAt,
    totalBreakSeconds,
    now,
  );

  const wouldBeEarlyLeave =
    day?.checkInAt != null && day.checkOutAt == null && isEarlyLeave(now, day.shiftDate);

  const hasOpenShift = day?.checkInAt != null && day.checkOutAt == null && !day.isMissedCheckout;

  const warnings: string[] = [];
  if (isWeekendOff) {
    warnings.push("Saturday and Sunday are weekend days — the office is closed.");
  }
  if (day?.isLate) {
    warnings.push(`You checked in late (after ${formatLateCheckInDeadline()}).`);
  }
  if (day?.isEarlyLeave) {
    warnings.push(`You checked out early (before ${EXPECTED_CHECK_OUT_TIME_PKT}).`);
  }
  if (day?.isMissedCheckout) {
    warnings.push(
      `This shift was marked absent because you did not check out by ${formatLateCheckOutDeadline()}.`,
    );
  }
  if (wouldBeEarlyLeave && state !== "checked_out") {
    warnings.push(
      `Checking out now would be marked as early leave (before ${EXPECTED_CHECK_OUT_TIME_PKT}).`,
    );
  }

  const overtime = day
    ? computeOvertimeSnapshot(day, now)
    : { isActive: false, startedAt: null, endedAt: null, elapsedSeconds: 0 };

  if (overtime.isActive) {
    warnings.push(`Overtime is in progress (past ${EXPECTED_CHECK_OUT_TIME_PKT}).`);
  }
  if (
    hasOpenShift &&
    day &&
    isPastMissedCheckOutDeadline(now, day.shiftDate) &&
    !day.isMissedCheckout
  ) {
    warnings.push(
      `You missed the check-out deadline (${formatLateCheckOutDeadline()}). Check out now or this shift may be marked absent.`,
    );
  } else if (
    hasOpenShift &&
    day &&
    !isPastMissedCheckOutDeadline(now, day.shiftDate) &&
    now.getTime() > getExpectedCheckOutAt(day.shiftDate).getTime()
  ) {
    warnings.push(
      `Check out by ${formatLateCheckOutDeadline()} to complete your shift (15 min grace after ${EXPECTED_CHECK_OUT_TIME_PKT}).`,
    );
  }
  if (breakRemainingSeconds <= 0 && state !== "checked_out") {
    warnings.push("You have used the full 60-minute break allowance for this shift.");
  } else if (breakRemainingSeconds > 0 && breakRemainingSeconds <= 300 && state !== "checked_out") {
    warnings.push(
      `About ${Math.ceil(breakRemainingSeconds / 60)} minutes of break time remaining.`,
    );
  }

  warnings.push(...buildMonthlyLateWarnings(monthlyLate, day?.isLate ?? false));

  const startBreakResult = canStartBreak(breakSessions, now);
  const endBreakResult = canEndBreak(breakSessions, now);

  return {
    pktNow: formatInTimeZone(now, BUSINESS_TIMEZONE, PKT_DATETIME_12H_FORMAT),
    shiftDate,
    state,
    isWeekendOff,
    employeeInactive: false,
    attendanceDay: day,
    breakSessions,
    totalBreakSeconds,
    breakRemainingSeconds,
    elapsedShiftSeconds,
    overtime,
    statusAt: now.toISOString(),
    activeBreakStartedAt: activeBreak ? activeBreak.startedAt.toISOString() : null,
    wouldBeEarlyLeave,
    monthlyLate,
    warnings,
    actions: {
      canCheckIn: !isWeekendOff && !day?.checkInAt,
      canCheckOut: hasOpenShift && !activeBreak,
      canStartBreak: hasOpenShift && startBreakResult.ok,
      canEndBreak: hasOpenShift && endBreakResult.ok,
    },
  };
}

export function lateFlagForCheckIn(checkInAt: Date, shiftDate: string): boolean {
  return isLateCheckIn(checkInAt, shiftDate);
}
