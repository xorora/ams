import { addDays, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  BUSINESS_TIMEZONE,
  CHECK_IN_GRACE_MINUTES,
  EXPECTED_CHECK_IN_HOUR,
  EXPECTED_CHECK_OUT_HOUR,
  EXPECTED_CHECK_OUT_MINUTE,
  SHIFT_DATE_NOON_BOUNDARY_HOUR,
} from "./constants";

export type CompanySlug = "xorora" | "crest-led";

export type CompanyShiftConfig = {
  expectedCheckInHour: number;
  expectedCheckInMinute: number;
  checkInGraceMinutes: number;
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
    expectedCheckOutHour: EXPECTED_CHECK_OUT_HOUR,
    expectedCheckOutMinute: EXPECTED_CHECK_OUT_MINUTE,
    checkOutNextDay: true,
    shiftDateBoundaryHour: SHIFT_DATE_NOON_BOUNDARY_HOUR,
  },
  "crest-led": {
    expectedCheckInHour: 9,
    expectedCheckInMinute: 0,
    checkInGraceMinutes: 15,
    expectedCheckOutHour: 17,
    expectedCheckOutMinute: 0,
    checkOutNextDay: false,
    shiftDateBoundaryHour: 0,
  },
};

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
