export type LateRelaxationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type SubmitLateRelaxationInput = {
  yearMonth: string;
  reason: string;
};
