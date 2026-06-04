import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export type ReportDateRange = {
  from: string;
  to: string;
};

/** Default report window: first day of current month through today (PKT). */
export function defaultReportDateRange(): ReportDateRange {
  const to = formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy-MM-dd");
  const from = `${to.slice(0, 8)}01`;
  return { from, to };
}
