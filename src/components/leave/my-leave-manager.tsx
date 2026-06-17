"use client";

import { useState } from "react";
import { LeaveBalanceCards } from "@/components/leave/leave-balance-cards";
import { LeaveDetailSheet } from "@/components/leave/leave-detail-sheet";
import { emptyLeaveForm, type LeaveFormValues, LeaveSheet } from "@/components/leave/leave-sheet";
import { LeaveTable } from "@/components/leave/leave-table";
import { Button } from "@/components/ui/button";
import { cancelLeaveRequestAction, submitLeaveRequestAction } from "@/lib/leave/actions";
import type { SerializedLeaveRequest } from "@/lib/leave/serialize";
import type { LeaveBalance } from "@/lib/leave/types";
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
  className,
}: MyLeaveManagerProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LeaveFormValues>(emptyLeaveForm);
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [viewRequest, setViewRequest] = useState<SerializedLeaveRequest | null>(null);

  function openApply() {
    setForm(emptyLeaveForm());
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
          leaveType: form.leaveType,
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
    <div className={cn("flex min-h-0 flex-1 flex-col gap-6 overflow-hidden", className)}>
      {canApply ? (
        <div className="shrink-0 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-medium">Leave balance</h2>
              <p className="text-muted-foreground text-sm">
                Your entitlements for the current year.
              </p>
            </div>
            <Button type="button" onClick={openApply}>
              Apply for leave
            </Button>
          </div>

          <LeaveBalanceCards balances={balances} />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        <h2 className="shrink-0 font-medium">My requests</h2>
        <LeaveTable
          className="min-h-0 flex-1"
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
        />
      ) : null}
    </div>
  );
}
