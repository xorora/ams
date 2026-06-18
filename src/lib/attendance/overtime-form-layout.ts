import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "./constants";

export function formatOvertimeSlipDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const yy = String(year).slice(-2);
  return `${day}/${month}/${yy}`;
}

export function formatOvertimeSlipTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatInTimeZone(date, BUSINESS_TIMEZONE, "h:mm a");
}

export function formatOvertimeTotalHours(seconds: number): string {
  const hours = seconds / 3600;
  if (Number.isInteger(hours)) {
    return String(hours);
  }
  return hours.toFixed(1);
}
