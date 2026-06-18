"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EligibleOvertimeTable } from "@/components/overtime/eligible-overtime-table";
import { OvertimeDetailSheet } from "@/components/overtime/overtime-detail-sheet";
import { emptyOvertimeForm, OvertimeSheet } from "@/components/overtime/overtime-sheet";
import { OvertimeTable } from "@/components/overtime/overtime-table";
import { cancelOvertimeRequestAction, submitOvertimeRequestAction } from "@/lib/overtime/actions";
import type {
  SerializedEligibleOvertimeDay,
  SerializedOvertimeRequest,
} from "@/lib/overtime/serialize";
import { toastAsync } from "@/lib/toast";
import { cn } from "@/lib/utils";

type MyOvertimeManagerProps = {
  eligibleDays: SerializedEligibleOvertimeDay[];
  requests: SerializedOvertimeRequest[];
  employeeName: string;
  designation?: string | null;
  className?: string;
};

export function MyOvertimeManager({
  eligibleDays,
  requests,
  employeeName,
  designation,
  className,
}: MyOvertimeManagerProps) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<SerializedEligibleOvertimeDay | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyOvertimeForm());
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [viewRequest, setViewRequest] = useState<SerializedOvertimeRequest | null>(null);

  function openApply(day: SerializedEligibleOvertimeDay) {
    setSelectedDay(day);
    setForm(emptyOvertimeForm());
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setSelectedDay(null);
    setForm(emptyOvertimeForm());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedDay) {
      return;
    }

    setSaving(true);

    try {
      await toastAsync(
        submitOvertimeRequestAction({
          attendanceDayId: selectedDay.attendanceDayId,
          workDescription: form.workDescription,
        }).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Submitting overtime request…",
          success: "Overtime request submitted successfully.",
        },
      );
      closeForm();
      router.refresh();
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(id: string) {
    if (!window.confirm("Cancel this overtime request?")) {
      return;
    }

    setActionPending(true);

    try {
      await toastAsync(
        cancelOvertimeRequestAction(id).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Cancelling overtime request…",
          success: "Overtime request cancelled.",
        },
      );
      router.refresh();
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-6 md:min-h-0 md:flex-1 md:overflow-hidden", className)}>
      <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
        <div className="shrink-0">
          <h2 className="font-medium">Eligible days</h2>
          <p className="text-muted-foreground text-sm">
            Apply for overtime on shifts where at least 2 hours of overtime was tracked.
          </p>
        </div>
        <EligibleOvertimeTable
          className="md:min-h-0 md:flex-1"
          days={eligibleDays}
          onApply={openApply}
        />
      </div>

      <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
        <h2 className="shrink-0 font-medium">My requests</h2>
        <OvertimeTable
          className="md:min-h-0 md:flex-1"
          requests={requests}
          onView={setViewRequest}
          onCancel={handleCancel}
          actionPending={actionPending}
        />
      </div>

      <OvertimeDetailSheet
        open={viewRequest !== null}
        onOpenChange={(open) => {
          if (!open) {
            setViewRequest(null);
          }
        }}
        request={viewRequest}
      />

      <OvertimeSheet
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
          }
        }}
        day={selectedDay}
        form={form}
        onFormChange={setForm}
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={closeForm}
        employeeName={employeeName}
        designation={designation}
      />
    </div>
  );
}
