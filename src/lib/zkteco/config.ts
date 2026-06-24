import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

/** Device timezone for ADMS handshake and punch parsing. */
export function getZktecoTimezone(): string {
  return process.env.ZKTECO_TIMEZONE?.trim() || BUSINESS_TIMEZONE;
}

/** UTC offset in hours for ADMS TimeZone handshake field (e.g. 5 for Asia/Karachi). */
export function getZktecoTimezoneOffsetHours(): number {
  const tz = getZktecoTimezone();
  if (tz === "Asia/Karachi") {
    return 5;
  }
  return 5;
}

export function getZktecoDeviceToken(): string | undefined {
  const token = process.env.ZKTECO_DEVICE_TOKEN?.trim();
  return token || undefined;
}

export function getZktecoDefaultCompanySlug(): string {
  return process.env.ZKTECO_DEFAULT_COMPANY_SLUG?.trim() || "xorora";
}

/** When true, sync employees from every active AMS company to the device. */
export function shouldSyncAllCompanies(): boolean {
  return process.env.ZKTECO_SYNC_ALL_COMPANIES?.trim() === "true";
}

const DEFAULT_DEVICE_ONLINE_THRESHOLD_SECONDS = 180;
const DEFAULT_DEVICE_STALE_THRESHOLD_SECONDS = 900;

/** How recently the device must have heartbeated to count as online (default 3 min). */
export function getDeviceOnlineThresholdMs(): number {
  const seconds = Number.parseInt(process.env.ZKTECO_DEVICE_ONLINE_THRESHOLD_SECONDS ?? "", 10);
  const resolved =
    Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_DEVICE_ONLINE_THRESHOLD_SECONDS;
  return resolved * 1000;
}

/** After this window without heartbeat the device is offline (default 15 min). */
export function getDeviceStaleThresholdMs(): number {
  const seconds = Number.parseInt(process.env.ZKTECO_DEVICE_STALE_THRESHOLD_SECONDS ?? "", 10);
  const resolved =
    Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_DEVICE_STALE_THRESHOLD_SECONDS;
  return resolved * 1000;
}
