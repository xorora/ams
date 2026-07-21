"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { LateRelaxationTable } from "@/components/late-relaxation/late-relaxation-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  formatLateFinePkr,
  MONTHLY_LATE_ALLOWANCE,
  type MonthlyLateSummary,
} from "@/lib/attendance/late-fines-utils";
import {
  cancelLateRelaxationRequestAction,
  submitLateRelaxationRequestAction,
} from "@/lib/late-relaxation/actions";
import type { SerializedLateRelaxationRequest } from "@/lib/late-relaxation/serialize";
import { toastAsync } from "@/lib/toast";
import { cn } from "@/lib/utils";

const LateRelaxationDetailSheet = dynamic(
  () =>
    import("@/components/late-relaxation/late-relaxation-detail-sheet").then(
      (module) => module.LateRelaxationDetailSheet,
    ),
  { loading: () => null },
);

type MyLateRelaxationManagerProps = {
  yearMonth: string;
  summary: MonthlyLateSummary;
  requests: SerializedLateRelaxationRequest[];
  className?: string;
};

export function MyLateRelaxationManager({
  yearMonth,
  summary,
  requests,
  className,
}: MyLateRelaxationManagerProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [viewRequest, setViewRequest] = useState<SerializedLateRelaxationRequest | null>(null);

  const eligible = summary.lateCount > MONTHLY_LATE_ALLOWANCE && !summary.finesWaived;
  const hasBlockingRequest = requests.some(
    (request) =>
      request.yearMonth === yearMonth &&
      (request.status === "pending" || request.status === "approved"),
  );
  const canSubmit = eligible && !hasBlockingRequest;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await toastAsync(
        submitLateRelaxationRequestAction({ yearMonth, reason }).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Submitting relaxation request…",
          success: "Relaxation request submitted.",
        },
      );
      setReason("");
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm("Cancel this relaxation request?")) {
      return;
    }

    setActionPending(true);
    try {
      await toastAsync(
        cancelLateRelaxationRequestAction(id).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Cancelling request…",
          success: "Request cancelled.",
        },
      );
      setViewRequest(null);
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 md:min-h-0 md:flex-1 md:overflow-hidden", className)}>
      <div className="shrink-0 space-y-4">
        <div className="rounded-lg border px-4 py-3">
          <p className="font-medium text-sm">{yearMonth} late summary</p>
          <p className="mt-1 text-muted-foreground text-sm">
            {summary.lateCount} late check-in{summary.lateCount === 1 ? "" : "s"} ·{" "}
            {summary.freeLatesRemaining} free remaining of {MONTHLY_LATE_ALLOWANCE}
          </p>
          {summary.finesWaived ? (
            <p className="mt-1 text-sm text-emerald-800">
              Late fines for this month are waived.
            </p>
          ) : summary.totalFinePkr > 0 ? (
            <p className="mt-1 text-amber-800 text-sm">
              Pending fines: {formatLateFinePkr(summary.totalFinePkr)} ({summary.fineableLates}{" "}
              fined late{summary.fineableLates === 1 ? "" : "s"})
            </p>
          ) : (
            <p className="mt-1 text-muted-foreground text-sm">
              No late fines yet this month.
            </p>
          )}
        </div>

        {summary.finesWaived ? (
          <Alert>
            <AlertTitle>Fines waived</AlertTitle>
            <AlertDescription>
              An approved relaxation covers {yearMonth}. Late marks still appear on attendance, but
              no fine is charged.
            </AlertDescription>
          </Alert>
        ) : canSubmit ? (
          <form className="space-y-3 rounded-lg border p-4" onSubmit={handleSubmit}>
            <div>
              <h2 className="font-medium">Request late fine relaxation</h2>
              <p className="mt-1 text-muted-foreground text-sm">
                You have more than {MONTHLY_LATE_ALLOWANCE} lates this month. If HR approves, all
                late fines for {yearMonth} will be waived.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="relaxation-reason">Reason</Label>
              <textarea
                id="relaxation-reason"
                required
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why you are requesting a late fine waiver…"
                rows={4}
                className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </div>
            <Button type="submit" disabled={saving || !reason.trim()}>
              Submit request
            </Button>
          </form>
        ) : eligible && hasBlockingRequest ? (
          <Alert>
            <AlertTitle>Request already submitted</AlertTitle>
            <AlertDescription>
              You already have a pending or approved relaxation for {yearMonth}.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertTitle>Not eligible yet</AlertTitle>
            <AlertDescription>
              You can request a late fine relaxation after more than {MONTHLY_LATE_ALLOWANCE} late
              check-ins in the current month.
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
        <h2 className="shrink-0 font-medium">My requests</h2>
        <LateRelaxationTable
          className="md:min-h-0 md:flex-1"
          requests={requests}
          onView={setViewRequest}
          onCancel={handleCancel}
          actionPending={actionPending}
        />
      </div>

      <LateRelaxationDetailSheet
        request={viewRequest}
        open={Boolean(viewRequest)}
        onOpenChange={(open) => {
          if (!open) {
            setViewRequest(null);
          }
        }}
        onCancel={handleCancel}
        actionPending={actionPending}
      />
    </div>
  );
}
