import { formatInTimeZone } from "date-fns-tz";
import { PKT_DATETIME_12H_FORMAT } from "@/lib/admin/display";
import { isWeekendDate } from "@/lib/leave/working-days";
import {
  type CompanyShiftConfig,
  getExpectedCheckOutAt,
  getShiftDateForCompany,
  getShiftScheduleLabels,
  isEarlyLeaveForCompany,
  isLateCheckInForCompany,
  isPastMissedCheckOutDeadlineForCompany,
} from "./company-shift";
import { BUSINESS_TIMEZONE, MAX_BREAK_SECONDS } from "./constants";
import { buildMonthlyLateWarnings, type MonthlyLateSummary } from "./late-fines";
import {
  type BreakSessionInput,
  canEndBreak,
  canStartBreak,
  computeElapsedShiftSeconds,
  computeTotalBreakSeconds,
  getActiveBreak,
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
  totalBreakSeconds: number;
};

export type TodayStatusPayload = {
  pktNow: string;
  shiftDate: string;
  shiftSchedule: {
    expectedCheckInTime: string;
    expectedCheckOutTime: string;
    lateCheckInDeadline: string;
    lateCheckOutDeadline: string;
    checkInGraceMinutes: number;
    checkOutGraceMinutes: number;
  };
  state: WorkState;
  isWeekendOff: boolean;
  employeeInactive: boolean;
  attendanceDay: AttendanceDaySnapshot | null;
  breakSessions: BreakSessionInput[];
  totalBreakSeconds: number;
  breakRemainingSeconds: number;
  elapsedShiftSeconds: number | null;
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
  shiftConfig: CompanyShiftConfig,
  now: Date = new Date(),
): TodayStatusPayload {
  const shiftScheduleLabels = getShiftScheduleLabels(shiftConfig);
  const shiftDate = getShiftDateForCompany(now, shiftConfig);
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
    day?.checkInAt != null &&
    day.checkOutAt == null &&
    isEarlyLeaveForCompany(now, day.shiftDate, shiftConfig);

  const hasOpenShift = day?.checkInAt != null && day.checkOutAt == null && !day.isMissedCheckout;

  const warnings: string[] = [];
  if (isWeekendOff) {
    warnings.push("Saturday and Sunday are weekend days — the office is closed.");
  }
  if (day?.isLate) {
    warnings.push(`You checked in late (after ${shiftScheduleLabels.lateCheckInDeadline}).`);
  }
  if (day?.isEarlyLeave) {
    warnings.push(`You checked out early (before ${shiftScheduleLabels.expectedCheckOutTime}).`);
  }
  if (day?.isMissedCheckout) {
    warnings.push(
      `This shift was marked absent because you did not check out by ${shiftScheduleLabels.lateCheckOutDeadline}.`,
    );
  }
  if (wouldBeEarlyLeave && state !== "checked_out") {
    warnings.push(
      `Checking out now would be marked as early leave (before ${shiftScheduleLabels.expectedCheckOutTime}).`,
    );
  }

  if (
    hasOpenShift &&
    day &&
    isPastMissedCheckOutDeadlineForCompany(now, day.shiftDate, shiftConfig) &&
    !day.isMissedCheckout
  ) {
    warnings.push(
      `You missed the check-out deadline (${shiftScheduleLabels.lateCheckOutDeadline}). Check out now or this shift may be marked absent.`,
    );
  } else if (
    hasOpenShift &&
    day &&
    !isPastMissedCheckOutDeadlineForCompany(now, day.shiftDate, shiftConfig) &&
    now.getTime() > getExpectedCheckOutAt(day.shiftDate, shiftConfig).getTime()
  ) {
    warnings.push(
      `Check out by ${shiftScheduleLabels.lateCheckOutDeadline} to complete your shift (${shiftConfig.checkOutGraceMinutes} min grace after ${shiftScheduleLabels.expectedCheckOutTime}).`,
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
    shiftSchedule: {
      ...shiftScheduleLabels,
      checkInGraceMinutes: shiftConfig.checkInGraceMinutes,
      checkOutGraceMinutes: shiftConfig.checkOutGraceMinutes,
    },
    state,
    isWeekendOff,
    employeeInactive: false,
    attendanceDay: day,
    breakSessions,
    totalBreakSeconds,
    breakRemainingSeconds,
    elapsedShiftSeconds,
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

export function lateFlagForCheckIn(
  checkInAt: Date,
  shiftDate: string,
  shiftConfig: CompanyShiftConfig,
): boolean {
  return isLateCheckInForCompany(checkInAt, shiftDate, shiftConfig);
}
