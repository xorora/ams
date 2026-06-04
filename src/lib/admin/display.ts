import { formatInTimeZone } from "date-fns-tz";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

export function formatPktIso(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return formatInTimeZone(new Date(iso), BUSINESS_TIMEZONE, "yyyy-MM-dd HH:mm");
}

export function formatBreakDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
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
    default:
      return "secondary";
  }
}
