import { addDays, getDay, parse, startOfDay, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  BUSINESS_TIMEZONE,
  CHECK_IN_GRACE_MINUTES,
  CHECK_OUT_GRACE_MINUTES,
  EXPECTED_CHECK_IN_HOUR,
  EXPECTED_CHECK_OUT_HOUR,
  EXPECTED_CHECK_OUT_MINUTE,
  SHIFT_DATE_NOON_BOUNDARY_HOUR,
} from "./constants";

import {
  getCompanyFederalHolidayName,
  isCompanyFederalHoliday,
} from "./company-holidays";

const DAY_SHIFT_CHECK_IN_HOUR = 9;
const DAY_SHIFT_CHECK_OUT_HOUR = 17;
const DATE_FORMAT = "yyyy-MM-dd";

/** 0 = Sunday, 6 = Saturday */
const CLOSED_WEEKDAYS_XORORA = [0, 6] as const;
const CLOSED_WEEKDAYS_CREST_LED = [0] as const;

export type CompanySlug = "xorora" | "crest-led";

export type CompanyShiftConfig = {
  expectedCheckInHour: number;
  expectedCheckInMinute: number;
  checkInGraceMinutes: number;
  checkOutGraceMinutes: number;
  expectedCheckOutHour: number;
  expectedCheckOutMinute: number;
  /** When true, expected check-out is on the calendar day after shiftDate. */
  checkOutNextDay: boolean;
  /**
   * Local hour in PKT at which the calendar date becomes the shift start date.
   * Night shift uses noon; day shift uses midnight (standard calendar date).
   */
  shiftDateBoundaryHour: number;
  /** Weekdays when the office is closed (no check-in; cron marks weekend off). */
  closedWeekdays: readonly number[];
};

/** Xorora default from 2026-07-21: 3:00 PM – 12:00 AM PKT (+15 min grace). */
export const XORORA_AFTERNOON_SHIFT: CompanyShiftConfig = {
  expectedCheckInHour: EXPECTED_CHECK_IN_HOUR,
  expectedCheckInMinute: 0,
  checkInGraceMinutes: CHECK_IN_GRACE_MINUTES,
  checkOutGraceMinutes: CHECK_OUT_GRACE_MINUTES,
  expectedCheckOutHour: EXPECTED_CHECK_OUT_HOUR,
  expectedCheckOutMinute: EXPECTED_CHECK_OUT_MINUTE,
  checkOutNextDay: true,
  shiftDateBoundaryHour: SHIFT_DATE_NOON_BOUNDARY_HOUR,
  closedWeekdays: CLOSED_WEEKDAYS_XORORA,
};

/** Xorora evening override: 6:00 PM – 3:00 AM PKT (+15 min grace). */
export const XORORA_EVENING_SHIFT: CompanyShiftConfig = {
  expectedCheckInHour: 18,
  expectedCheckInMinute: 0,
  checkInGraceMinutes: CHECK_IN_GRACE_MINUTES,
  checkOutGraceMinutes: CHECK_OUT_GRACE_MINUTES,
  expectedCheckOutHour: 3,
  expectedCheckOutMinute: 0,
  checkOutNextDay: true,
  shiftDateBoundaryHour: SHIFT_DATE_NOON_BOUNDARY_HOUR,
  closedWeekdays: CLOSED_WEEKDAYS_XORORA,
};

/**
 * Xorora employees who keep the 6pm–3am evening shift.
 * Matched case-insensitively on full name.
 */
export const XORORA_EVENING_SHIFT_EMPLOYEE_NAMES = new Set([
  "daniyal zafar",
  "sadia saif",
]);

export const COMPANY_SHIFT_BY_SLUG: Record<CompanySlug, CompanyShiftConfig> = {
  xorora: XORORA_AFTERNOON_SHIFT,
  "crest-led": {
    expectedCheckInHour: DAY_SHIFT_CHECK_IN_HOUR,
    expectedCheckInMinute: 0,
    checkInGraceMinutes: CHECK_IN_GRACE_MINUTES,
    checkOutGraceMinutes: CHECK_OUT_GRACE_MINUTES,
    expectedCheckOutHour: DAY_SHIFT_CHECK_OUT_HOUR,
    expectedCheckOutMinute: 0,
    checkOutNextDay: false,
    shiftDateBoundaryHour: 0,
    closedWeekdays: CLOSED_WEEKDAYS_CREST_LED,
  },
};

export type ShiftScheduleLabels = {
  expectedCheckInTime: string;
  expectedCheckOutTime: string;
  lateCheckInDeadline: string;
  lateCheckOutDeadline: string;
};

function formatHourMinutePkt(hour: number, minute = 0): string {
  const local = `2000-01-01 ${pad2(hour)}:${pad2(minute)}:00`;
  const date = fromZonedTime(local, BUSINESS_TIMEZONE);
  return `${formatInTimeZone(date, BUSINESS_TIMEZONE, "h:mm a")} PKT`;
}

export function getShiftScheduleLabels(config: CompanyShiftConfig): ShiftScheduleLabels {
  const lateCheckInTotalMinutes =
    config.expectedCheckInHour * 60 + config.expectedCheckInMinute + config.checkInGraceMinutes;
  const lateCheckOutTotalMinutes =
    config.expectedCheckOutHour * 60 + config.expectedCheckOutMinute + config.checkOutGraceMinutes;

  return {
    expectedCheckInTime: formatHourMinutePkt(
      config.expectedCheckInHour,
      config.expectedCheckInMinute,
    ),
    expectedCheckOutTime: formatHourMinutePkt(
      config.expectedCheckOutHour,
      config.expectedCheckOutMinute,
    ),
    // Last on-time minute (inclusive). Late starts the following minute.
    lateCheckInDeadline: formatHourMinutePkt(
      Math.floor(lateCheckInTotalMinutes / 60) % 24,
      lateCheckInTotalMinutes % 60,
    ),
    lateCheckOutDeadline: formatHourMinutePkt(
      Math.floor(lateCheckOutTotalMinutes / 60) % 24,
      lateCheckOutTotalMinutes % 60,
    ),
  };
}

export function getCompanyShiftConfig(slug: string): CompanyShiftConfig {
  const config = COMPANY_SHIFT_BY_SLUG[slug as CompanySlug];
  if (!config) {
    return COMPANY_SHIFT_BY_SLUG.xorora;
  }
  return config;
}

/** Resolve shift for a company employee (Xorora evening overrides by name). */
export function getShiftConfigForEmployee(
  companySlug: string,
  fullName: string | null | undefined,
): CompanyShiftConfig {
  const slug = companySlug || "xorora";
  const normalizedName = fullName?.trim().toLowerCase() ?? "";

  if (slug === "xorora" && XORORA_EVENING_SHIFT_EMPLOYEE_NAMES.has(normalizedName)) {
    return XORORA_EVENING_SHIFT;
  }

  return getCompanyShiftConfig(slug);
}

function shiftDateDayOfWeek(shiftDate: string): number {
  return getDay(startOfDay(parse(shiftDate, DATE_FORMAT, new Date())));
}

/** Whether attendance is closed (weekends and, for Xorora, US federal holidays). */
export function isClosedShiftDate(
  shiftDate: string,
  config: CompanyShiftConfig,
  companySlug?: string,
): boolean {
  if (config.closedWeekdays.includes(shiftDateDayOfWeek(shiftDate))) {
    return true;
  }

  if (companySlug && isCompanyFederalHoliday(companySlug, shiftDate)) {
    return true;
  }

  return false;
}

/** Label for why a shift date is closed (holiday name or recurring weekend days). */
export function getClosedShiftDateReason(
  shiftDate: string,
  config: CompanyShiftConfig,
  companySlug?: string,
): string | null {
  const holidayName = companySlug ? getCompanyFederalHolidayName(companySlug, shiftDate) : null;
  if (holidayName) {
    return holidayName;
  }

  if (config.closedWeekdays.includes(shiftDateDayOfWeek(shiftDate))) {
    return getClosedDaysLabel(config);
  }

  return null;
}

export function getClosedDaysLabel(config: CompanyShiftConfig): string {
  const onlySunday =
    config.closedWeekdays.length === 1 && config.closedWeekdays.includes(0);
  return onlySunday ? "Sunday" : "Saturday and Sunday";
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function zonedTimeOnShiftDate(
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

/** Shift start date for a timestamp, using company-specific boundary rules. */
export function getShiftDateForCompany(at: Date, config: CompanyShiftConfig): string {
  const hour = Number(formatInTimeZone(at, BUSINESS_TIMEZONE, "H"));
  const calendarDate = formatInTimeZone(at, BUSINESS_TIMEZONE, "yyyy-MM-dd");
  if (hour >= config.shiftDateBoundaryHour) {
    return calendarDate;
  }
  return shiftDateAddDays(calendarDate, -1);
}

export function getLateCheckInDeadline(shiftDate: string, config: CompanyShiftConfig): Date {
  const { expectedCheckInHour, expectedCheckInMinute, checkInGraceMinutes } = config;
  const totalMinutes = expectedCheckInHour * 60 + expectedCheckInMinute + checkInGraceMinutes;
  return zonedTimeOnShiftDate(shiftDate, {
    hour: Math.floor(totalMinutes / 60) % 24,
    minute: totalMinutes % 60,
    second: 0,
  });
}

export function getExpectedCheckOutAt(shiftDate: string, config: CompanyShiftConfig): Date {
  const checkoutDate = config.checkOutNextDay ? shiftDateAddDays(shiftDate, 1) : shiftDate;
  return zonedTimeOnShiftDate(checkoutDate, {
    hour: config.expectedCheckOutHour,
    minute: config.expectedCheckOutMinute,
    second: 0,
  });
}

export function getLateCheckOutDeadline(shiftDate: string, config: CompanyShiftConfig): Date {
  const expected = getExpectedCheckOutAt(shiftDate, config);
  return new Date(expected.getTime() + config.checkOutGraceMinutes * 60_000);
}

export function isLateCheckInForCompany(
  checkInAt: Date,
  shiftDate: string,
  config: CompanyShiftConfig,
): boolean {
  const lastOnTimeInstant = getLateCheckInDeadline(shiftDate, config);
  // Grace is inclusive for the whole deadline minute (e.g. 09:15:00–09:15:59 on time).
  // Late starts at the next minute (09:16:00 / 18:16:00).
  return checkInAt.getTime() >= lastOnTimeInstant.getTime() + 60_000;
}

export function isEarlyLeaveForCompany(
  checkOutAt: Date,
  shiftDate: string,
  config: CompanyShiftConfig,
): boolean {
  return checkOutAt.getTime() < getExpectedCheckOutAt(shiftDate, config).getTime();
}

export function isPastMissedCheckOutDeadlineForCompany(
  at: Date,
  shiftDate: string,
  config: CompanyShiftConfig,
): boolean {
  return at.getTime() > getLateCheckOutDeadline(shiftDate, config).getTime();
}

/**
 * Whether an open shift for `shiftDate` should still drive the employee dashboard.
 * Returns false once the check-out grace deadline has passed so a new shift day can start.
 */
export function isActiveShiftWindow(
  shiftDate: string,
  at: Date,
  config: CompanyShiftConfig,
): boolean {
  const currentShiftDate = getShiftDateForCompany(at, config);
  if (shiftDate > currentShiftDate) {
    return false;
  }
  return !isPastMissedCheckOutDeadlineForCompany(at, shiftDate, config);
}

/**
 * Shift date to evaluate when the daily absent / missed-checkout cron runs (~04:00 PKT).
 * Night shift uses the noon boundary; day shift uses the previous calendar date.
 */
export function getAutoAbsentShiftDateForCompany(runAt: Date, config: CompanyShiftConfig): string {
  if (config.shiftDateBoundaryHour === 0) {
    const calendarDate = formatInTimeZone(runAt, BUSINESS_TIMEZONE, "yyyy-MM-dd");
    return shiftDateAddDays(calendarDate, -1);
  }
  return getShiftDateForCompany(runAt, config);
}

/** Default admin attendance filter: current shift date only. */
export function getDefaultAttendanceFilterRange(
  at: Date,
  config: CompanyShiftConfig,
): { from: string; to: string } {
  const shiftDate = getShiftDateForCompany(at, config);
  return { from: shiftDate, to: shiftDate };
}
