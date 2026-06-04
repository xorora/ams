"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import {
  AttendanceFilters,
  type AttendanceFiltersState,
} from "@/components/attendance/attendance-filters";
import {
  type AttendanceFormValues,
  AttendanceSheet,
  type AttendanceStatus,
  attendanceToForm,
  emptyAttendanceForm,
  pktLocalToIso,
} from "@/components/attendance/attendance-sheet";
import { AttendanceTable } from "@/components/attendance/attendance-table";
import {
  createAttendanceAction,
  deleteAttendanceAction,
  markAttendanceStatusAction,
  updateAttendanceAction,
} from "@/lib/admin/actions";
import { attendanceListQuery } from "@/lib/admin/query-params";
import type { SerializedAttendance, SerializedEmployee } from "@/lib/admin/serialize";

type AttendanceManagerProps = {
  employees: SerializedEmployee[];
  items: SerializedAttendance[];
  total: number;
  filters: AttendanceFiltersState;
};

export function AttendanceManager({
  employees,
  items,
  total,
  filters: initialFilters,
}: AttendanceManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<AttendanceFiltersState>(initialFilters);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AttendanceFormValues>(emptyAttendanceForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  function applyFilters(next: AttendanceFiltersState) {
    setFilters(next);
    startTransition(() => {
      router.replace(`/admin/attendance${attendanceListQuery(next)}`);
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyAttendanceForm());
    setFormOpen(true);
    setFeedback(null);
  }

  function openEdit(record: SerializedAttendance) {
    setEditingId(record.id);
    setForm(attendanceToForm(record));
    setFormOpen(true);
    setFeedback(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyAttendanceForm());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    const checkInIso = pktLocalToIso(form.checkInAt);
    const checkOutIso = pktLocalToIso(form.checkOutAt);

    try {
      if (editingId) {
        const result = await updateAttendanceAction(editingId, {
          status: form.status,
          checkInAt: checkInIso,
          checkOutAt: checkOutIso,
          notes: form.notes || null,
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
        setFeedback({ type: "success", text: "Attendance updated." });
      } else {
        if (!form.employeeId) {
          throw new Error("Select an employee.");
        }
        const result = await createAttendanceAction({
          employeeId: form.employeeId,
          shiftDate: form.shiftDate,
          status: form.status,
          checkInAt: checkInIso,
          checkOutAt: checkOutIso,
          notes: form.notes || null,
        });
        if (!result.ok) {
          throw new Error(result.error);
        }
        setFeedback({ type: "success", text: "Attendance record created." });
      }

      closeForm();
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Save failed",
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkStatus(id: string, status: AttendanceStatus) {
    setFeedback(null);
    try {
      const result = await markAttendanceStatusAction(id, status);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: `Marked as ${status}.` });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Status update failed",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this attendance record? This cannot be undone.")) {
      return;
    }

    setFeedback(null);
    try {
      const result = await deleteAttendanceAction(id);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: "Attendance record deleted." });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Delete failed",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <AttendanceFilters
        filters={filters}
        onFiltersChange={(updater) => {
          const next = typeof updater === "function" ? updater(filters) : updater;
          applyFilters(next);
        }}
        employees={employees}
        onAddRecord={openCreate}
      />

      {feedback && <FeedbackBanner type={feedback.type} text={feedback.text} />}

      <AttendanceSheet
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
          }
        }}
        editingId={editingId}
        employees={employees}
        form={form}
        onFormChange={setForm}
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={closeForm}
      />

      <p className="text-muted-foreground text-sm">
        {isPending ? "Loading…" : `${total} record${total === 1 ? "" : "s"}`}
      </p>

      <AttendanceTable
        items={items}
        loading={isPending}
        onEdit={openEdit}
        onMarkStatus={handleMarkStatus}
        onDelete={handleDelete}
      />
    </div>
  );
}
