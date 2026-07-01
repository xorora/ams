import { subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { BUSINESS_TIMEZONE, EXPECTED_CHECK_IN_HOUR } from "@/lib/attendance/constants";

export function getZktimeBaseUrl(): string | undefined {
  const url = process.env.ZKTIME_BASE_URL?.trim();
  return url || undefined;
}

export function getZktimeApiKey(): string | undefined {
  const apiKey = process.env.ZKTIME_API_KEY?.trim();
  return apiKey || undefined;
}

export function isZktimeConfigured(): boolean {
  return Boolean(getZktimeBaseUrl() && getZktimeApiKey());
}

/**
 * Default `since` when no attendance sync cursor exists.
 * Uses ZKTIME_DEFAULT_SYNC_SINCE when set; otherwise previous calendar day at
 * night-shift check-in (18:00) so punches after midnight still belong to the prior shift.
 */
export function getDefaultAttendanceSyncSince(at: Date = new Date()): string {
  const envDefault = process.env.ZKTIME_DEFAULT_SYNC_SINCE?.trim();
  if (envDefault) {
    return envDefault;
  }

  const timezone = getZktimeTimezone();
  const calendarDate = formatInTimeZone(at, timezone, "yyyy-MM-dd");
  const anchor = fromZonedTime(`${calendarDate} 12:00:00`, timezone);
  const previousDay = formatInTimeZone(subDays(anchor, 1), timezone, "yyyy-MM-dd");
  return `${previousDay} ${String(EXPECTED_CHECK_IN_HOUR).padStart(2, "0")}:00:00`;
}

/** @deprecated Use getDefaultAttendanceSyncSince — midnight missed evening check-ins. */
export function getTodayAttendanceSyncSince(): string {
  return getDefaultAttendanceSyncSince();
}

/** Punch timestamps from the ZKTime bridge are in this timezone. */
export function getZktimeTimezone(): string {
  return process.env.ZKTIME_TIMEZONE?.trim() || BUSINESS_TIMEZONE;
}

export function getDefaultCompanySlug(): string {
  return process.env.ZKTIME_DEFAULT_COMPANY_SLUG?.trim() || "xorora";
}
