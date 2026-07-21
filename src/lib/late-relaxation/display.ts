import type { LateRelaxationStatus } from "./types";

export function lateRelaxationStatusBadgeVariant(
  status: LateRelaxationStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "approved":
      return "default";
    case "pending":
      return "secondary";
    case "rejected":
      return "destructive";
    case "cancelled":
      return "outline";
    default:
      return "secondary";
  }
}

export function lateRelaxationStatusLabel(status: LateRelaxationStatus): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "pending":
      return "Pending";
    case "rejected":
      return "Rejected";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/** Formats `YYYY-MM` as a readable month label (e.g. July 2026). */
export function formatRelaxationMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr);
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 1 || monthIndex > 12) {
    return yearMonth;
  }
  return new Intl.DateTimeFormat("en-PK", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthIndex - 1, 1)));
}
