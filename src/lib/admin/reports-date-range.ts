import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export type ReportDateRange = {
  from: string;
  to: string;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Default report window: first day of current month through today (PKT). */
export function defaultReportDateRange(): ReportDateRange {
  const to = formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy-MM-dd");
  const from = `${to.slice(0, 8)}01`;
  return { from, to };
}

/**
 * Monday–Sunday week containing today in Asia/Karachi.
 * Uses ISO day-of-week (1 = Monday … 7 = Sunday).
 */
export function currentWeekReportDateRange(now: Date = new Date()): ReportDateRange {
  const today = formatInTimeZone(now, BUSINESS_TIMEZONE, "yyyy-MM-dd");
  const isoDow = Number(formatInTimeZone(now, BUSINESS_TIMEZONE, "i"));
  const todayNoon = fromZonedTime(`${today} 12:00:00`, BUSINESS_TIMEZONE);
  const monday = addDays(todayNoon, -(isoDow - 1));
  const sunday = addDays(monday, 6);
  return {
    from: formatInTimeZone(monday, BUSINESS_TIMEZONE, "yyyy-MM-dd"),
    to: formatInTimeZone(sunday, BUSINESS_TIMEZONE, "yyyy-MM-dd"),
  };
}

/** Fill missing dates from defaults and swap when from is after to. */
export function resolveReportDateRange(
  from: string | undefined,
  to: string | undefined,
  defaults: ReportDateRange = defaultReportDateRange(),
): ReportDateRange {
  const resolvedFrom = from?.trim() || defaults.from;
  const resolvedTo = to?.trim() || defaults.to;

  if (resolvedFrom > resolvedTo) {
    return { from: resolvedTo, to: resolvedFrom };
  }

  return { from: resolvedFrom, to: resolvedTo };
}

export type ReportDateRangeValidation =
  | { ok: true; from: string; to: string }
  | { ok: false; message: string };

/** Validate and normalize a report date range for client-side navigation. */
export function validateReportDateRangeInput(
  from: string,
  to: string,
  defaults: ReportDateRange = defaultReportDateRange(),
): ReportDateRangeValidation {
  const resolved = resolveReportDateRange(from, to, defaults);

  if (!DATE_PATTERN.test(resolved.from) || !DATE_PATTERN.test(resolved.to)) {
    return { ok: false, message: "Dates must be YYYY-MM-DD." };
  }

  return { ok: true, from: resolved.from, to: resolved.to };
}
