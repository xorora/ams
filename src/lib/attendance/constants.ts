/** Business timezone for all attendance rules. */
export const BUSINESS_TIMEZONE = "Asia/Karachi";

/** Expected night-shift check-in anchor (18:00 PKT). */
export const EXPECTED_CHECK_IN_HOUR = 18;

/** Grace period after expected check-in before a check-in is marked late (check-in only). */
export const CHECK_IN_GRACE_MINUTES = 15;

/** Last on-time check-in: expected check-in + grace (18:15 PKT). */
export const LATE_CHECK_IN_HOUR = EXPECTED_CHECK_IN_HOUR;
export const LATE_CHECK_IN_MINUTE = CHECK_IN_GRACE_MINUTES;

export function formatLateCheckInDeadline(): string {
  return `${String(LATE_CHECK_IN_HOUR).padStart(2, "0")}:${String(LATE_CHECK_IN_MINUTE).padStart(2, "0")} PKT`;
}

/** Expected check-out on the morning after shift date (03:00 PKT). */
export const EXPECTED_CHECK_OUT_HOUR = 3;
export const EXPECTED_CHECK_OUT_MINUTE = 0;

/**
 * Local hour in PKT at which the calendar date becomes the shift start date.
 * Before noon, timestamps belong to the previous calendar day's shift.
 */
export const SHIFT_DATE_NOON_BOUNDARY_HOUR = 12;

/** Maximum total break duration per shift (seconds). */
export const MAX_BREAK_SECONDS = 3600;
