import type { EligibleOvertimeDay, OvertimeRequestListItem } from "./overtime-request-service";

export type SerializedEligibleOvertimeDay = Omit<
  EligibleOvertimeDay,
  "checkInAt" | "checkOutAt" | "overtimeStartedAt" | "overtimeEndedAt"
> & {
  checkInAt: string;
  checkOutAt: string;
  overtimeStartedAt: string;
  overtimeEndedAt: string;
};

export type SerializedOvertimeRequest = Omit<
  OvertimeRequestListItem,
  | "checkInAt"
  | "checkOutAt"
  | "overtimeStartedAt"
  | "overtimeEndedAt"
  | "reviewedAt"
  | "createdAt"
  | "updatedAt"
> & {
  checkInAt: string;
  checkOutAt: string;
  overtimeStartedAt: string;
  overtimeEndedAt: string;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeEligibleOvertimeDay(
  day: EligibleOvertimeDay,
): SerializedEligibleOvertimeDay {
  return {
    ...day,
    checkInAt: day.checkInAt.toISOString(),
    checkOutAt: day.checkOutAt.toISOString(),
    overtimeStartedAt: day.overtimeStartedAt.toISOString(),
    overtimeEndedAt: day.overtimeEndedAt.toISOString(),
  };
}

export function serializeOvertimeRequest(
  request: OvertimeRequestListItem,
): SerializedOvertimeRequest {
  return {
    ...request,
    checkInAt: request.checkInAt.toISOString(),
    checkOutAt: request.checkOutAt.toISOString(),
    overtimeStartedAt: request.overtimeStartedAt.toISOString(),
    overtimeEndedAt: request.overtimeEndedAt.toISOString(),
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}
