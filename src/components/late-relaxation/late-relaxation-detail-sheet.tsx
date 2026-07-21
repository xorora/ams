"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPktIso } from "@/lib/admin/display";
import {
  formatLateFinePkr,
  MONTHLY_LATE_ALLOWANCE,
  summarizeMonthlyLates,
} from "@/lib/attendance/late-fines-utils";
import {
  formatRelaxationMonth,
  lateRelaxationStatusBadgeVariant,
  lateRelaxationStatusLabel,
} from "@/lib/late-relaxation/display";
import type { SerializedLateRelaxationRequest } from "@/lib/late-relaxation/serialize";
import { cn } from "@/lib/utils";

type LateRelaxationDetailSheetProps = {
  request: SerializedLateRelaxationRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string, notes?: string | null) => void;
  onCancel?: (id: string) => void;
  actionPending?: boolean;
  showEmployee?: boolean;
};

function employeeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

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
  const [rejectNotes, setRejectNotes] = useState("");
  const [rejectMode, setRejectMode] = useState(false);

  useEffect(() => {
    if (!open) {
      setRejectNotes("");
      setRejectMode(false);
    }
  }, [open]);

  useEffect(() => {
    setRejectNotes("");
    setRejectMode(false);
  }, [request?.id]);

  if (!request) {
    return null;
  }

  const isPending = request.status === "pending";
  const monthLabel = formatRelaxationMonth(request.yearMonth);
  const fineSummary = summarizeMonthlyLates(request.lateCountAtRequest);
  const hasAdminActions = Boolean(onApprove || onReject);
  const hasEmployeeCancel = Boolean(onCancel);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="shrink-0 space-y-3 border-b px-6 py-5 text-left">
          <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
            <div className="space-y-1">
              <SheetTitle className="text-xl">Late relaxation</SheetTitle>
              <SheetDescription className="text-sm">
                Review the request and waive monthly late fines if approved.
              </SheetDescription>
            </div>
            <Badge
              variant={lateRelaxationStatusBadgeVariant(request.status)}
              className="shrink-0"
            >
              {lateRelaxationStatusLabel(request.status)}
            </Badge>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {showEmployee ? (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
              <div
                aria-hidden
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background font-semibold text-sm"
              >
                {employeeInitials(request.employeeName)}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold leading-tight">{request.employeeName}</p>
                <p className="mt-0.5 truncate text-muted-foreground text-sm">
                  <span className="font-mono text-xs">{request.employeeCode}</span>
                  {request.employeeDepartment ? ` · ${request.employeeDepartment}` : null}
                </p>
                {request.employeeEmail ? (
                  <p className="mt-0.5 truncate text-muted-foreground text-xs">
                    {request.employeeEmail}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <FactCard label="Month" value={monthLabel} />
            <FactCard
              label="Lates at request"
              value={String(request.lateCountAtRequest)}
              hint={`Allowance is ${MONTHLY_LATE_ALLOWANCE}`}
            />
            <FactCard
              label="Fineable lates"
              value={String(fineSummary.fineableLates)}
            />
            <FactCard
              label="Fines to waive"
              value={formatLateFinePkr(fineSummary.totalFinePkr)}
              emphasize={fineSummary.totalFinePkr > 0}
            />
          </div>

          {isPending && hasAdminActions ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
              <p className="font-medium text-amber-950 dark:text-amber-100">
                Approving waives late fines for {monthLabel}
              </p>
              <p className="mt-1 text-amber-950/80 text-xs dark:text-amber-100/80">
                Late marks stay on attendance. Only the fine amounts for this calendar month are
                zeroed.
              </p>
            </div>
          ) : null}

          <section className="space-y-2">
            <h3 className="font-medium text-sm">Reason</h3>
            <div className="rounded-xl border bg-background px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap">
              {request.reason}
            </div>
          </section>

          <section className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Submitted</p>
              <p className="mt-0.5">{formatPktIso(request.createdAt)}</p>
            </div>
            {request.reviewedAt ? (
              <div>
                <p className="text-muted-foreground text-xs">Reviewed</p>
                <p className="mt-0.5">{formatPktIso(request.reviewedAt)}</p>
              </div>
            ) : null}
          </section>

          {request.reviewNotes ? (
            <section className="space-y-2">
              <h3 className="font-medium text-sm">Review notes</h3>
              <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm whitespace-pre-wrap">
                {request.reviewNotes}
              </div>
            </section>
          ) : null}

          {isPending && rejectMode && onReject ? (
            <section className="space-y-2">
              <Label htmlFor="relaxation-reject-notes">Rejection notes (optional)</Label>
              <textarea
                id="relaxation-reject-notes"
                value={rejectNotes}
                onChange={(event) => setRejectNotes(event.target.value)}
                placeholder="Share why this request is being rejected…"
                rows={3}
                disabled={actionPending}
                className="min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </section>
          ) : null}
        </div>

        {isPending && (hasAdminActions || hasEmployeeCancel) ? (
          <SheetFooter className="shrink-0 flex-col gap-2 border-t px-6 py-4 sm:flex-col">
            {onCancel ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={actionPending}
                onClick={() => onCancel(request.id)}
              >
                Cancel request
              </Button>
            ) : null}

            {onReject && onApprove ? (
              rejectMode ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={actionPending}
                    onClick={() => setRejectMode(false)}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="flex-1"
                    disabled={actionPending}
                    onClick={() => onReject(request.id, rejectNotes.trim() || null)}
                  >
                    Confirm reject
                  </Button>
                </div>
              ) : (
                <div className="flex w-full flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={actionPending}
                    onClick={() => setRejectMode(true)}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    className="flex-1"
                    disabled={actionPending}
                    onClick={() => onApprove(request.id)}
                  >
                    Approve & waive fines
                  </Button>
                </div>
              )
            ) : null}

            {onReject && !onApprove ? (
              <Button
                type="button"
                variant="destructive"
                className="w-full"
                disabled={actionPending}
                onClick={() => onReject(request.id, rejectNotes.trim() || null)}
              >
                Reject
              </Button>
            ) : null}

            {onApprove && !onReject ? (
              <Button
                type="button"
                className="w-full"
                disabled={actionPending}
                onClick={() => onApprove(request.id)}
              >
                Approve & waive fines
              </Button>
            ) : null}
          </SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function FactCard({
  label,
  value,
  hint,
  emphasize = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3.5 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-1 font-semibold tabular-nums tracking-tight",
          emphasize && "text-foreground",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-muted-foreground text-[11px]">{hint}</p> : null}
    </div>
  );
}
