import { formatDistanceToNow } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export const PKT_TIME_12H_FORMAT = "h:mm a";
export const PKT_DATETIME_12H_FORMAT = "yyyy-MM-dd h:mm a";
export const PKT_DATETIME_LONG_12H_FORMAT = "MMM d, yyyy 'at' h:mm a";
export const PKT_CLOCK_12H_FORMAT = "EEEE, d MMM yyyy · h:mm:ss a";

export function formatPktHourMinute(hour: number, minute = 0): string {
  const local = `2000-01-01 ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  const date = fromZonedTime(local, BUSINESS_TIMEZONE);
  return formatInTimeZone(date, BUSINESS_TIMEZONE, PKT_TIME_12H_FORMAT);
}

export function formatPktHourMinuteWithZone(hour: number, minute = 0): string {
  return `${formatPktHourMinute(hour, minute)} PKT`;
}

export function formatPktIso(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return formatInTimeZone(new Date(iso), BUSINESS_TIMEZONE, PKT_DATETIME_12H_FORMAT);
}

export function formatRelativeTime(iso: string | null, emptyValue = "Never"): string {
  if (!iso) {
    return emptyValue;
  }
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function formatPktDateTime(value: Date | string | null, emptyValue = "—"): string {
  if (!value) {
    return emptyValue;
  }
  const date = typeof value === "string" ? new Date(value) : value;
  return formatInTimeZone(date, BUSINESS_TIMEZONE, PKT_DATETIME_12H_FORMAT);
}

export function formatPktTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatInTimeZone(date, BUSINESS_TIMEZONE, PKT_TIME_12H_FORMAT);
}

export function formatPktDateTimeLong(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return formatInTimeZone(date, BUSINESS_TIMEZONE, PKT_DATETIME_LONG_12H_FORMAT);
}

export function formatShiftDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatBreakDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

export function formatAttendanceStatus(status: string): string {
  if (status === "weekend_off") {
    return "weekend off";
  }
  return status.replaceAll("_", " ");
}

export function attendanceStatusBadgeVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "present":
      return "default";
    case "absent":
      return "destructive";
    case "leave":
      return "outline";
    case "weekend_off":
      return "secondary";
    default:
      return "secondary";
  }
}
