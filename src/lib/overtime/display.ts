import type { OvertimeRequestStatus } from "./types";

export function overtimeStatusBadgeVariant(
  status: OvertimeRequestStatus,
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

export function overtimeStatusLabel(status: OvertimeRequestStatus): string {
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
