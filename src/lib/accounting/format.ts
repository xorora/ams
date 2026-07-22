import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export function formatSalaryPkr(amount: number): string {
  return `PKR ${amount.toLocaleString("en-PK")}`;
}

export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const monthIndex = Number.parseInt(month ?? "", 10) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) {
    return yearMonth;
  }
  const date = new Date(Number.parseInt(year, 10), monthIndex, 1);
  return date.toLocaleDateString("en-PK", { month: "long", year: "numeric" });
}

/** Short month label for dropdowns, e.g. "Jan 26". */
export function formatYearMonthShort(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const monthIndex = Number.parseInt(month ?? "", 10) - 1;
  if (!year || monthIndex < 0 || monthIndex > 11) {
    return yearMonth;
  }
  const date = new Date(Number.parseInt(year, 10), monthIndex, 1);
  const monthLabel = date.toLocaleDateString("en-US", { month: "short" });
  return `${monthLabel} ${year.slice(-2)}`;
}

export function getCurrentYearMonth(): string {
  return formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy-MM");
}

/** Recent months ending at current PKT month (inclusive), newest first. */
export function listRecentYearMonths(count = 18): string[] {
  const current = getCurrentYearMonth();
  const [yearStr, monthStr] = current.split("-");
  let year = Number.parseInt(yearStr ?? "", 10);
  let month = Number.parseInt(monthStr ?? "", 10);
  const months: string[] = [];

  for (let i = 0; i < count; i += 1) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
  }

  return months;
}

export function formatJoiningDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return formatInTimeZone(date, BUSINESS_TIMEZONE, "dd MMM yyyy");
}
