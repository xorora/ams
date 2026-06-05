"use client";

import { useState } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { LeaveBalanceCards } from "@/components/leave/leave-balance-cards";
import { emptyLeaveForm, type LeaveFormValues, LeaveSheet } from "@/components/leave/leave-sheet";
import { LeaveTable } from "@/components/leave/leave-table";
import { Button } from "@/components/ui/button";
import { cancelLeaveRequestAction, submitLeaveRequestAction } from "@/lib/leave/actions";
import type { SerializedLeaveRequest } from "@/lib/leave/serialize";
import type { LeaveBalance } from "@/lib/leave/types";

type MyLeaveManagerProps = {
  balances: LeaveBalance[];
  requests: SerializedLeaveRequest[];
};

export function MyLeaveManager({ balances, requests }: MyLeaveManagerProps) {
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LeaveFormValues>(emptyLeaveForm);
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState(false);

  function openApply() {
    setForm(emptyLeaveForm());
    setFormOpen(true);
    setFeedback(null);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(emptyLeaveForm());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const result = await submitLeaveRequestAction({
        leaveType: form.leaveType,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason,
        medicalCertificateNote: form.medicalCertificateNote || null,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      setFeedback({ type: "success", text: "Leave request submitted successfully." });
      closeForm();
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to submit leave request.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm("Cancel this leave request?")) {
      return;
    }

    setActionPending(true);
    setFeedback(null);

    try {
      const result = await cancelLeaveRequestAction(id);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: "Leave request cancelled." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to cancel leave request.",
      });
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {feedback ? <FeedbackBanner type={feedback.type} text={feedback.text} /> : null}

      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">Leave balance</h2>
          <p className="text-muted-foreground text-sm">Your entitlements for the current year.</p>
        </div>
        <Button type="button" onClick={openApply}>
          Apply for leave
        </Button>
      </div>

      <LeaveBalanceCards balances={balances} />

      <div>
        <h2 className="mb-4 font-medium">My requests</h2>
        <LeaveTable requests={requests} onCancel={handleCancel} actionPending={actionPending} />
      </div>

      <LeaveSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        form={form}
        onFormChange={setForm}
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={closeForm}
      />
    </div>
  );
}
