export type LeaveType = "annual" | "casual" | "sick";
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveBalance = {
  leaveType: LeaveType;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
};
