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

export function getZktimeDefaultSyncSince(): string {
  return process.env.ZKTIME_DEFAULT_SYNC_SINCE?.trim() || "2000-01-01 00:00:00";
}

/** Punch timestamps from the ZKTime bridge are in this timezone. */
export function getZktimeTimezone(): string {
  return (
    process.env.ZKTIME_TIMEZONE?.trim() || process.env.WDMS_TIMEZONE?.trim() || BUSINESS_TIMEZONE
  );
}

export function getDefaultCompanySlug(): string {
  return (
    process.env.ZKTIME_DEFAULT_COMPANY_SLUG?.trim() ||
    process.env.WDMS_DEFAULT_COMPANY_SLUG?.trim() ||
    "xorora"
  );
}
