import { addDays, subDays } from "date-fns";
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

const DAY_SHIFT_CHECK_IN_HOUR = 9;
const DAY_SHIFT_CHECK_OUT_HOUR = 17;

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
};

export const COMPANY_SHIFT_BY_SLUG: Record<CompanySlug, CompanyShiftConfig> = {
  xorora: {
    expectedCheckInHour: EXPECTED_CHECK_IN_HOUR,
    expectedCheckInMinute: 0,
    checkInGraceMinutes: CHECK_IN_GRACE_MINUTES,
    checkOutGraceMinutes: CHECK_OUT_GRACE_MINUTES,
    expectedCheckOutHour: EXPECTED_CHECK_OUT_HOUR,
    expectedCheckOutMinute: EXPECTED_CHECK_OUT_MINUTE,
    checkOutNextDay: true,
    shiftDateBoundaryHour: SHIFT_DATE_NOON_BOUNDARY_HOUR,
  },
  "crest-led": {
    expectedCheckInHour: DAY_SHIFT_CHECK_IN_HOUR,
    expectedCheckInMinute: 0,
    checkInGraceMinutes: CHECK_IN_GRACE_MINUTES,
    checkOutGraceMinutes: CHECK_OUT_GRACE_MINUTES,
    expectedCheckOutHour: DAY_SHIFT_CHECK_OUT_HOUR,
    expectedCheckOutMinute: 0,
    checkOutNextDay: false,
    shiftDateBoundaryHour: 0,
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
  return checkInAt.getTime() > getLateCheckInDeadline(shiftDate, config).getTime();
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
