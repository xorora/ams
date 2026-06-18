import type { LeaveType } from "./types";

export const ENTITLED_LEAVE_TYPES = [
  "annual",
  "casual",
  "sick",
] as const satisfies readonly LeaveType[];

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
  unpaid: {
    annualDays: 0,
    workingDaysOnly: true,
    requiresApproval: true,
    requiresMedicalCertificate: false,
  },
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Annual Leave",
  casual: "Casual Leave",
  sick: "Sick Leave",
  unpaid: "Emergency Unpaid Leave",
};
