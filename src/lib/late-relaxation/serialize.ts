import type { LateRelaxationListItem } from "./late-relaxation-service";

export type SerializedLateRelaxationRequest = Omit<
  LateRelaxationListItem,
  "reviewedAt" | "createdAt" | "updatedAt"
> & {
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeLateRelaxationRequest(
  request: LateRelaxationListItem,
): SerializedLateRelaxationRequest {
  return {
    ...request,
    reviewedAt: request.reviewedAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
  };
}
