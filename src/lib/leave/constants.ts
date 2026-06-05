import type { LeaveType } from "./types";

export const LEAVE_ENTITLEMENTS: Record<
  LeaveType,
  {
    annualDays: number;
    workingDaysOnly: boolean;
    requiresApproval: boolean;
    requiresMedicalCertificate: boolean;
  }
> = {
  annual: {
    annualDays: 14,
    workingDaysOnly: true,
    requiresApproval: false,
    requiresMedicalCertificate: false,
  },
  casual: {
    annualDays: 10,
    workingDaysOnly: false,
    requiresApproval: true,
    requiresMedicalCertificate: false,
  },
  sick: {
    annualDays: 8,
    workingDaysOnly: false,
    requiresApproval: true,
    requiresMedicalCertificate: true,
  },
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual Leave",
  casual: "Casual Leave",
  sick: "Sick Leave",
};
