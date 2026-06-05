import type { LeaveListItem } from "./leave-service";

export type SerializedLeaveRequest = Omit<
  LeaveListItem,
  "reviewedAt" | "createdAt" | "updatedAt"
> & {
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeLeaveRequest(request: LeaveListItem): SerializedLeaveRequest {
  return {
    ...request,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}
