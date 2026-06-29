import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export function getWdmsBaseUrl(): string | undefined {
  const url = process.env.WDMS_BASE_URL?.trim();
  return url || undefined;
}

export function getWdmsUsername(): string | undefined {
  const username = process.env.WDMS_USERNAME?.trim();
  return username || undefined;
}

export function getWdmsPassword(): string | undefined {
  const password = process.env.WDMS_PASSWORD?.trim();
  return password || undefined;
}

export function isWdmsConfigured(): boolean {
  return Boolean(getWdmsBaseUrl() && getWdmsUsername() && getWdmsPassword());
}

/** Punch timestamps from WDMS are in this timezone (device/server local). */
export function getWdmsTimezone(): string {
  return process.env.WDMS_TIMEZONE?.trim() || BUSINESS_TIMEZONE;
}

export function getDefaultCompanySlug(): string {
  return process.env.WDMS_DEFAULT_COMPANY_SLUG?.trim() || "xorora";
}

export function getWdmsCompanyId(): number | undefined {
  const raw = process.env.WDMS_COMPANY_ID?.trim();
  if (!raw) {
    return undefined;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function getWdmsDefaultAreaName(): string {
  return process.env.WDMS_DEFAULT_AREA_NAME?.trim() || "AMS Office";
}
