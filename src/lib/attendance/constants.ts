/** Business timezone for all attendance rules. */
export const BUSINESS_TIMEZONE = "Asia/Karachi";

/** Expected night-shift check-in anchor (18:00 PKT). */
export const EXPECTED_CHECK_IN_HOUR = 18;

/** On-time check-in if at or before this time on the shift date. */
export const LATE_CHECK_IN_HOUR = 18;
export const LATE_CHECK_IN_MINUTE = 30;

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
