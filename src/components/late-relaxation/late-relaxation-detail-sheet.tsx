"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  lateRelaxationStatusBadgeVariant,
  lateRelaxationStatusLabel,
} from "@/lib/late-relaxation/display";
import type { SerializedLateRelaxationRequest } from "@/lib/late-relaxation/serialize";
import { formatPktIso } from "@/lib/admin/display";

type LateRelaxationDetailSheetProps = {
  request: SerializedLateRelaxationRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
  actionPending?: boolean;
  showEmployee?: boolean;
};

export function LateRelaxationDetailSheet({
  request,
  open,
  onOpenChange,
  onApprove,
  onReject,
  onCancel,
  actionPending = false,
  showEmployee = false,
}: LateRelaxationDetailSheetProps) {
  if (!request) {
    return null;
  }

  const isPending = request.status === "pending";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-6 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Late relaxation</SheetTitle>
          <SheetDescription>
            Request for {request.yearMonth}
            {showEmployee ? ` · ${request.employeeName}` : null}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 text-sm">
          {showEmployee ? (
            <div>
              <p className="text-muted-foreground text-xs">Employee</p>
              <p className="font-medium">
                {request.employeeName}{" "}
                <span className="font-mono text-muted-foreground text-xs">
                  ({request.employeeCode})
                </span>
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-xs">Status</p>
            <Badge variant={lateRelaxationStatusBadgeVariant(request.status)}>
              {lateRelaxationStatusLabel(request.status)}
            </Badge>
          </div>

          <div>
            <p className="text-muted-foreground text-xs">Month</p>
            <p className="font-medium tabular-nums">{request.yearMonth}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs">Late count at request</p>
            <p className="font-medium tabular-nums">{request.lateCountAtRequest}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs">Reason</p>
            <p className="whitespace-pre-wrap">{request.reason}</p>
          </div>

          <div>
            <p className="text-muted-foreground text-xs">Submitted</p>
            <p>{formatPktIso(request.createdAt)}</p>
          </div>

          {request.reviewedAt ? (
            <div>
              <p className="text-muted-foreground text-xs">Reviewed</p>
              <p>{formatPktIso(request.reviewedAt)}</p>
            </div>
          ) : null}

          {request.reviewNotes ? (
            <div>
              <p className="text-muted-foreground text-xs">Review notes</p>
              <p className="whitespace-pre-wrap">{request.reviewNotes}</p>
            </div>
          ) : null}
        </div>

        {isPending && (onApprove || onReject || onCancel) ? (
          <SheetFooter className="mt-auto flex-row gap-2 sm:justify-end">
            {onCancel ? (
              <Button
                type="button"
                variant="outline"
                disabled={actionPending}
                onClick={() => onCancel(request.id)}
              >
                Cancel request
              </Button>
            ) : null}
            {onReject ? (
              <Button
                type="button"
                variant="destructive"
                disabled={actionPending}
                onClick={() => onReject(request.id)}
              >
                Reject
              </Button>
            ) : null}
            {onApprove ? (
              <Button
                type="button"
                disabled={actionPending}
                onClick={() => onApprove(request.id)}
              >
                Approve
              </Button>
            ) : null}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
