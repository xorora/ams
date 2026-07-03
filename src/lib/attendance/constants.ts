import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

/** Business timezone for all attendance rules. */
export const BUSINESS_TIMEZONE = "Asia/Karachi";

function formatHourMinutePkt(hour: number, minute = 0): string {
  const local = `2000-01-01 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const date = fromZonedTime(local, BUSINESS_TIMEZONE);
  return `${formatInTimeZone(date, BUSINESS_TIMEZONE, "h:mm a")} PKT`;
}

/** Expected night-shift check-in anchor (18:00 PKT). */
export const EXPECTED_CHECK_IN_HOUR = 18;

/** Grace period after expected check-in before a check-in is marked late. */
export const CHECK_IN_GRACE_MINUTES = 15;

/** Grace period after expected check-out before a shift is finalized as present without check-out. */
export const CHECK_OUT_GRACE_MINUTES = 15;

/** Last on-time check-in: expected check-in + grace (18:15 PKT). */
export const LATE_CHECK_IN_HOUR = EXPECTED_CHECK_IN_HOUR;
export const LATE_CHECK_IN_MINUTE = CHECK_IN_GRACE_MINUTES;

export function formatLateCheckInDeadline(): string {
  return formatHourMinutePkt(LATE_CHECK_IN_HOUR, LATE_CHECK_IN_MINUTE);
}

/** Expected check-out on the morning after shift date (03:00 PKT). */
export const EXPECTED_CHECK_OUT_HOUR = 3;
export const EXPECTED_CHECK_OUT_MINUTE = 0;

/** Last on-time check-out: expected check-out + grace (03:15 PKT). */
export const LATE_CHECK_OUT_HOUR = EXPECTED_CHECK_OUT_HOUR;
export const LATE_CHECK_OUT_MINUTE = CHECK_OUT_GRACE_MINUTES;

export function formatLateCheckOutDeadline(): string {
  return formatHourMinutePkt(LATE_CHECK_OUT_HOUR, LATE_CHECK_OUT_MINUTE);
}

export const EXPECTED_CHECK_IN_TIME_PKT = formatHourMinutePkt(EXPECTED_CHECK_IN_HOUR);
export const EXPECTED_CHECK_OUT_TIME_PKT = formatHourMinutePkt(
  EXPECTED_CHECK_OUT_HOUR,
  EXPECTED_CHECK_OUT_MINUTE,
);

/**
 * Local hour in PKT at which the calendar date becomes the shift start date.
 * Before noon, timestamps belong to the previous calendar day's shift.
 */
export const SHIFT_DATE_NOON_BOUNDARY_HOUR = 12;

/** Maximum total break duration per shift (seconds). */
export const MAX_BREAK_SECONDS = 3600;

/** Free late check-ins allowed per calendar month (by shift date). */
export const MONTHLY_LATE_ALLOWANCE = 3;

/** Fine charged for each late check-in after the monthly allowance. */
export const LATE_FINE_AMOUNT_PKR = 1000;
