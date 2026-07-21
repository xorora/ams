import { addDays, getDay, parse, startOfDay, subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import {
  BUSINESS_TIMEZONE,
  CHECK_IN_GRACE_MINUTES,
  CHECK_OUT_GRACE_MINUTES,
  EXPECTED_CHECK_IN_HOUR,
  EXPECTED_CHECK_OUT_HOUR,
  EXPECTED_CHECK_OUT_MINUTE,
  MAX_BREAK_SECONDS,
  SHIFT_DATE_NOON_BOUNDARY_HOUR,
} from "./constants";

import {
  getCompanyFederalHolidayName,
  isCompanyFederalHoliday,
} from "./company-holidays";
import type { EmployeeShiftPreset, XororaShiftPreset } from "@/db/schema";

export type { EmployeeShiftPreset, XororaShiftPreset };

const DAY_SHIFT_CHECK_IN_HOUR = 9;
const DAY_SHIFT_CHECK_OUT_HOUR = 17;
const DATE_FORMAT = "yyyy-MM-dd";

/** 0 = Sunday, 6 = Saturday */
const CLOSED_WEEKDAYS_XORORA = [0, 6] as const;
const CLOSED_WEEKDAYS_CREST_LED = [0] as const;

export type CompanySlug = "xorora" | "crest-led";

/** Fixed meal-break window on the shift calendar day (PKT). */
export type ScheduledBreakWindow = {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
};

export type ScheduledBreakConfig = ScheduledBreakWindow & {
  /** 0 = Sunday … 6 = Saturday; replaces the default window on that weekday. */
  weekdayOverrides?: Partial<Record<number, ScheduledBreakWindow>>;
};

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
  /**
   * When set, break may only be started inside this window.
   * Cap equals the window length for that weekday (e.g. Fri Crest = 90 min).
   */
  scheduledBreak: ScheduledBreakConfig | null;
};

/** Xorora default from 2026-07-21: 3:00 PM – 12:00 AM PKT (+15 min grace). Break 7–8 PM. */
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
  scheduledBreak: { startHour: 19, startMinute: 0, endHour: 20, endMinute: 0 },
};

/**
 * First shift date that uses the afternoon (3pm) default for Xorora.
 * Shift dates before this keep the legacy evening (6pm–3am) schedule.
 */
export const XORORA_AFTERNOON_SHIFT_EFFECTIVE_DATE = "2026-07-21";

/** Xorora evening override: 6:00 PM – 3:00 AM PKT (+15 min grace). Break 10–11 PM. */
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
  scheduledBreak: { startHour: 22, startMinute: 0, endHour: 23, endMinute: 0 },
};

/**
 * Xorora employees who keep the 6pm–3am evening shift (seed / legacy fallback).
 * Prefer `employees.shift_preset` from the admin panel.
 */
export const XORORA_EVENING_SHIFT_EMPLOYEE_NAMES = new Set([
  "daniyal zafar",
  "sadia saif",
]);

export function isEmployeeShiftPreset(
  value: string | null | undefined,
): value is EmployeeShiftPreset {
  return value === "afternoon" || value === "evening" || value === "day";
}

/** @deprecated Prefer isEmployeeShiftPreset. */
export function isXororaShiftPreset(value: string | null | undefined): value is XororaShiftPreset {
  return value === "afternoon" || value === "evening";
}

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
    // Mon–Sat (ex Fri): 1–2 PM. Friday: 1:00–2:30 PM. Sunday closed.
    scheduledBreak: {
      startHour: 13,
      startMinute: 0,
      endHour: 14,
      endMinute: 0,
      weekdayOverrides: {
        5: { startHour: 13, startMinute: 0, endHour: 14, endMinute: 30 },
      },
    },
  },
};

/** Crest LED evening override: 6:00 PM – 3:00 AM PKT (+15 min grace). */
export const CREST_LED_EVENING_SHIFT: CompanyShiftConfig = {
  expectedCheckInHour: 18,
  expectedCheckInMinute: 0,
  checkInGraceMinutes: CHECK_IN_GRACE_MINUTES,
  checkOutGraceMinutes: CHECK_OUT_GRACE_MINUTES,
  expectedCheckOutHour: 3,
  expectedCheckOutMinute: 0,
  checkOutNextDay: true,
  shiftDateBoundaryHour: SHIFT_DATE_NOON_BOUNDARY_HOUR,
  closedWeekdays: CLOSED_WEEKDAYS_CREST_LED,
  scheduledBreak: null,
};

export const CREST_LED_DAY_SHIFT = COMPANY_SHIFT_BY_SLUG["crest-led"];

export type ShiftScheduleLabels = {
  expectedCheckInTime: string;
  expectedCheckOutTime: string;
  lateCheckInDeadline: string;
  lateCheckOutDeadline: string;
  /** e.g. "7:00 PM – 8:00 PM PKT", or null when breaks are not windowed. */
  scheduledBreakTime: string | null;
};

function formatHourMinutePkt(hour: number, minute = 0): string {
  const local = `2000-01-01 ${pad2(hour)}:${pad2(minute)}:00`;
  const date = fromZonedTime(local, BUSINESS_TIMEZONE);
  return `${formatInTimeZone(date, BUSINESS_TIMEZONE, "h:mm a")} PKT`;
}

export function getShiftScheduleLabels(
  config: CompanyShiftConfig,
  shiftDate?: string | null,
): ShiftScheduleLabels {
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
    scheduledBreakTime: formatScheduledBreakTime(config, shiftDate),
  };
}

function formatBreakRange(window: ScheduledBreakWindow): string {
  const start = formatHourMinutePkt(window.startHour, window.startMinute);
  const end = formatHourMinutePkt(window.endHour, window.endMinute);
  const startWithoutZone = start.replace(/ PKT$/, "");
  return `${startWithoutZone} – ${end}`;
}

export function resolveScheduledBreakWindow(
  shiftDate: string,
  config: CompanyShiftConfig,
): ScheduledBreakWindow | null {
  const breakConfig = config.scheduledBreak;
  if (!breakConfig) {
    return null;
  }
  const override = breakConfig.weekdayOverrides?.[shiftDateDayOfWeek(shiftDate)];
  if (override) {
    return override;
  }
  return {
    startHour: breakConfig.startHour,
    startMinute: breakConfig.startMinute,
    endHour: breakConfig.endHour,
    endMinute: breakConfig.endMinute,
  };
}

export function formatScheduledBreakTime(
  config: CompanyShiftConfig,
  shiftDate?: string | null,
): string | null {
  const breakConfig = config.scheduledBreak;
  if (!breakConfig) {
    return null;
  }

  if (shiftDate) {
    const window = resolveScheduledBreakWindow(shiftDate, config);
    return window ? formatBreakRange(window) : null;
  }

  const base = formatBreakRange(breakConfig);
  const friday = breakConfig.weekdayOverrides?.[5];
  if (friday) {
    const friEnd = formatHourMinutePkt(friday.endHour, friday.endMinute);
    return `${base} (Fri until ${friEnd})`;
  }
  return base;
}

/** Inclusive start / exclusive end bounds for the scheduled break on a shift date. */
export function getScheduledBreakBounds(
  shiftDate: string,
  config: CompanyShiftConfig,
): { start: Date; end: Date } | null {
  const breakWindow = resolveScheduledBreakWindow(shiftDate, config);
  if (!breakWindow) {
    return null;
  }
  return {
    start: zonedTimeOnShiftDate(shiftDate, {
      hour: breakWindow.startHour,
      minute: breakWindow.startMinute,
      second: 0,
    }),
    end: zonedTimeOnShiftDate(shiftDate, {
      hour: breakWindow.endHour,
      minute: breakWindow.endMinute,
      second: 0,
    }),
  };
}

export function isWithinScheduledBreakWindow(
  at: Date,
  shiftDate: string,
  config: CompanyShiftConfig,
): boolean {
  const bounds = getScheduledBreakBounds(shiftDate, config);
  if (!bounds) {
    return true;
  }
  const t = at.getTime();
  return t >= bounds.start.getTime() && t < bounds.end.getTime();
}

/** Max break seconds for the shift date (window length, or default 60 min). */
export function getMaxBreakSeconds(
  shiftDate: string | null | undefined,
  config: CompanyShiftConfig | null | undefined,
): number {
  if (!shiftDate || !config?.scheduledBreak) {
    return MAX_BREAK_SECONDS;
  }
  const window = resolveScheduledBreakWindow(shiftDate, config);
  if (!window) {
    return MAX_BREAK_SECONDS;
  }
  const startMinutes = window.startHour * 60 + window.startMinute;
  const endMinutes = window.endHour * 60 + window.endMinute;
  return Math.max(0, (endMinutes - startMinutes) * 60);
}

export function getCompanyShiftConfig(slug: string): CompanyShiftConfig {
  const config = COMPANY_SHIFT_BY_SLUG[slug as CompanySlug];
  if (!config) {
    return COMPANY_SHIFT_BY_SLUG.xorora;
  }
  return config;
}

/**
 * Resolve shift for a company employee.
 * Xorora uses `shiftPreset` (`afternoon` | `evening`).
 * Crest LED uses `shiftPreset` (`day` | `evening`); null defaults to day.
 * Name-based evening list is only a Xorora fallback when preset is unset.
 * Before {@link XORORA_AFTERNOON_SHIFT_EFFECTIVE_DATE}, all Xorora staff use evening.
 */
export function getShiftConfigForEmployee(
  companySlug: string,
  shiftPreset?: string | null,
  fullName?: string | null,
  shiftDate?: string | null,
): CompanyShiftConfig {
  const slug = companySlug || "xorora";

  if (slug === "xorora") {
    if (shiftDate && shiftDate < XORORA_AFTERNOON_SHIFT_EFFECTIVE_DATE) {
      return XORORA_EVENING_SHIFT;
    }
    if (shiftPreset === "evening") {
      return XORORA_EVENING_SHIFT;
    }
    if (shiftPreset === "afternoon") {
      return XORORA_AFTERNOON_SHIFT;
    }
    const normalizedName = fullName?.trim().toLowerCase() ?? "";
    if (XORORA_EVENING_SHIFT_EMPLOYEE_NAMES.has(normalizedName)) {
      return XORORA_EVENING_SHIFT;
    }
    return XORORA_AFTERNOON_SHIFT;
  }

  if (slug === "crest-led") {
    if (shiftPreset === "evening") {
      return CREST_LED_EVENING_SHIFT;
    }
    return CREST_LED_DAY_SHIFT;
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
