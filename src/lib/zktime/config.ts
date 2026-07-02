import { subDays, subHours, subMinutes } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

/** Overlap window applied when advancing the sync cursor, to tolerate punches the bridge delivers out of order (e.g. a device uploads a delayed early check-in after a later checkout has already been synced). */
const DEFAULT_SYNC_OVERLAP_MINUTES = 30;

const DEFAULT_ATTENDANCE_SYNC_LOOKBACK_HOURS = 48;

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
 * Uses ZKTIME_DEFAULT_SYNC_SINCE when set; otherwise midnight of the previous calendar day.
 *
 * Anchored at midnight (not an expected check-in hour) so early check-ins — someone
 * badging in at 17:40 for an 18:00 shift, for example — are never excluded by the
 * default cursor. Any employee-specific "expected" time is a scheduling concept, not
 * a bound on when a real punch can occur.
 */
export function getDefaultAttendanceSyncSince(at: Date = new Date()): string {
  const envDefault = process.env.ZKTIME_DEFAULT_SYNC_SINCE?.trim();
  if (envDefault) {
    return envDefault;
  }

  const timezone = getZktimeTimezone();
  const previousDay = formatInTimeZone(subDays(at, 1), timezone, "yyyy-MM-dd");
  return `${previousDay} 00:00:00`;
}

/** Rolling lookback window for attendance pulls (default: 48 hours = yesterday + today). */
export function getAttendanceSyncLookbackHours(): number {
  const raw = process.env.ZKTIME_ATTENDANCE_SYNC_LOOKBACK_HOURS?.trim();
  if (!raw) {
    return DEFAULT_ATTENDANCE_SYNC_LOOKBACK_HOURS;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ATTENDANCE_SYNC_LOOKBACK_HOURS;
}

export function getAttendanceSyncLookbackSince(at: Date = new Date()): string {
  const timezone = getZktimeTimezone();
  const lookbackAt = subHours(at, getAttendanceSyncLookbackHours());
  return formatInTimeZone(lookbackAt, timezone, "yyyy-MM-dd HH:mm:ss");
}

/** Default `since` for scheduled/manual attendance sync unless overridden explicitly. */
export function resolveAttendanceSyncSince(explicitSince?: string | null): string {
  const trimmed = explicitSince?.trim();
  if (trimmed) {
    return trimmed;
  }

  return getAttendanceSyncLookbackSince();
}

/**
 * Rewinds a bridge-provided `next_since` by a small overlap window before persisting it as
 * the sync cursor. Devices can upload punches to the bridge out of order (e.g. a delayed
 * early check-in syncs to the bridge after a later checkout already advanced the cursor
 * past it). Re-requesting a trailing window each cycle is safe: AMS dedupes inserts on
 * (card_no, punch_at), so re-fetched punches already saved are no-ops.
 */
export function applySyncOverlapBuffer(nextSince: string): string {
  const timezone = getZktimeTimezone();
  const parsed = fromZonedTime(nextSince, timezone);
  const buffered = subMinutes(parsed, DEFAULT_SYNC_OVERLAP_MINUTES);
  return formatInTimeZone(buffered, timezone, "yyyy-MM-dd HH:mm:ss");
}

/** Punch timestamps from the ZKTime bridge are in this timezone. */
export function getZktimeTimezone(): string {
  return process.env.ZKTIME_TIMEZONE?.trim() || BUSINESS_TIMEZONE;
}

export function getDefaultCompanySlug(): string {
  return process.env.ZKTIME_DEFAULT_COMPANY_SLUG?.trim() || "xorora";
}
