export type LeaveType = "annual" | "casual" | "sick" | "unpaid";
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveBalance = {
  leaveType: LeaveType;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
};

/** Unpaid leave taken or requested during the current probation period. */
export type UnpaidLeaveSummary = {
  used: number;
  pending: number;
  total: number;
};

export type EmployeeLeaveBalanceSummary = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  balances: LeaveBalance[];
};
