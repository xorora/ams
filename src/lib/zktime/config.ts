import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

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

/** Start of today in ZKTIME_TIMEZONE — used when no prior attendance sync cursor exists. */
export function getTodayAttendanceSyncSince(): string {
  const today = formatInTimeZone(new Date(), getZktimeTimezone(), "yyyy-MM-dd");
  return `${today} 00:00:00`;
}

/** Punch timestamps from the ZKTime bridge are in this timezone. */
export function getZktimeTimezone(): string {
  return process.env.ZKTIME_TIMEZONE?.trim() || BUSINESS_TIMEZONE;
}

export function getDefaultCompanySlug(): string {
  return process.env.ZKTIME_DEFAULT_COMPANY_SLUG?.trim() || "xorora";
}
