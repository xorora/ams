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
