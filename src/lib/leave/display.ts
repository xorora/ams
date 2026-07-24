import { LEAVE_TYPE_LABELS } from "./constants";
import type { LeaveRequestStatus, LeaveType } from "./types";

export function leaveTypeLabel(type: LeaveType): string {
  return LEAVE_TYPE_LABELS[type];
}

/** Format day counts for UI (keeps one decimal when fractional). */
export function formatLeaveDays(value: number): string {
  if (!Number.isFinite(value)) {
    return "0";
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function leaveStatusBadgeVariant(
  status: LeaveRequestStatus,
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

export function leaveStatusLabel(status: LeaveRequestStatus): string {
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
