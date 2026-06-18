"use client";

import { useState } from "react";
import { LeaveBalanceCards } from "@/components/leave/leave-balance-cards";
import { LeaveDetailSheet } from "@/components/leave/leave-detail-sheet";
import { emptyLeaveForm, type LeaveFormValues, LeaveSheet } from "@/components/leave/leave-sheet";
import { LeaveTable } from "@/components/leave/leave-table";
import { UnpaidLeaveSummaryCard } from "@/components/leave/unpaid-leave-summary-card";
import { Button } from "@/components/ui/button";
import { cancelLeaveRequestAction, submitLeaveRequestAction } from "@/lib/leave/actions";
import type { SerializedLeaveRequest } from "@/lib/leave/serialize";
import type { LeaveBalance, UnpaidLeaveSummary } from "@/lib/leave/types";
import { toastAsync } from "@/lib/toast";
import { cn } from "@/lib/utils";

type MyLeaveManagerProps = {
  balances: LeaveBalance[];
  requests: SerializedLeaveRequest[];
  companyName: string;
  employeeName: string;
  designation?: string | null;
  department?: string | null;
  canApply?: boolean;
  probationUnpaidOnly?: boolean;
  unpaidSummary?: UnpaidLeaveSummary;
  className?: string;
};

export function MyLeaveManager({
  balances,
  requests,
  companyName,
  employeeName,
  designation,
  department,
  canApply = true,
  probationUnpaidOnly = false,
  unpaidSummary = { used: 0, pending: 0, total: 0 },
  className,
}: MyLeaveManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LeaveFormValues>(emptyLeaveForm);
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [viewRequest, setViewRequest] = useState<SerializedLeaveRequest | null>(null);

  function openApply() {
    setForm(emptyLeaveForm(probationUnpaidOnly ? "unpaid" : "annual"));
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(emptyLeaveForm());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      await toastAsync(
        submitLeaveRequestAction({
          leaveType: probationUnpaidOnly ? "unpaid" : form.leaveType,
          startDate: form.startDate,
          endDate: form.endDate,
          reason: form.reason,
          medicalCertificateNote: form.medicalCertificateNote || null,
        }).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Submitting leave request…",
          success: "Leave request submitted successfully.",
        },
      );
      closeForm();
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm("Cancel this leave request?")) {
      return;
    }

    setActionPending(true);

    try {
      await toastAsync(
        cancelLeaveRequestAction(id).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Cancelling leave request…",
          success: "Leave request cancelled.",
        },
      );
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 md:min-h-0 md:flex-1 md:overflow-hidden", className)}>
      {canApply ? (
        <div className="shrink-0 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">
                {probationUnpaidOnly ? "Emergency unpaid leave" : "Leave balance"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {probationUnpaidOnly
                  ? "Track emergency unpaid leave taken during probation. Each request requires HR approval."
                  : "Your entitlements for the current year."}
              </p>
            </div>
            <Button type="button" onClick={openApply}>
              {probationUnpaidOnly ? "Apply for emergency leave" : "Apply for leave"}
            </Button>
          </div>

          {probationUnpaidOnly ? (
            <UnpaidLeaveSummaryCard summary={unpaidSummary} />
          ) : (
            <LeaveBalanceCards balances={balances} />
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
        <h2 className="shrink-0 font-medium">My requests</h2>
        <LeaveTable
          className="md:min-h-0 md:flex-1"
          requests={requests}
          onView={setViewRequest}
          onCancel={handleCancel}
          actionPending={actionPending}
        />
      </div>

      <LeaveDetailSheet
        open={viewRequest !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewRequest(null);
          }
        }}
        request={viewRequest}
        companyName={companyName}
        designation={designation}
        department={department}
        balances={balances}
      />

      {canApply ? (
        <LeaveSheet
          open={formOpen}
          onOpenChange={setFormOpen}
          form={form}
          onFormChange={setForm}
          saving={saving}
          onSubmit={handleSubmit}
          onCancel={closeForm}
          companyName={companyName}
          employeeName={employeeName}
          designation={designation}
          department={department}
          balances={balances}
          probationUnpaidOnly={probationUnpaidOnly}
        />
      ) : null}
    </div>
  );
}
