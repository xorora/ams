"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
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
import { attendanceListQuery, normalizeAttendanceDateRange } from "@/lib/admin/query-params";
import type { SerializedAttendance, SerializedEmployee } from "@/lib/admin/serialize";
import { toastAsync, toastError } from "@/lib/toast";

type AttendanceManagerProps = {
  employees: SerializedEmployee[];
  items: SerializedAttendance[];
  filters: AttendanceFiltersState;
};

export function AttendanceManager({
  employees,
  items,
  filters: initialFilters,
}: AttendanceManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filters, setFilters] = useState<AttendanceFiltersState>(initialFilters);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AttendanceFormValues>(emptyAttendanceForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  function applyFilters(updater: React.SetStateAction<AttendanceFiltersState>) {
    setFilters((current) => {
      const nextRaw = typeof updater === "function" ? updater(current) : updater;
      const { from, to } = normalizeAttendanceDateRange(nextRaw.from, nextRaw.to);
      const next = { ...nextRaw, from, to };
      startTransition(() => {
        router.replace(`/admin/attendance${attendanceListQuery(next)}`);
      });
      return next;
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyAttendanceForm());
    setFormOpen(true);
  }

  function openEdit(record: SerializedAttendance) {
    setEditingId(record.id);
    setForm(attendanceToForm(record));
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyAttendanceForm());
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    const checkInIso = pktLocalToIso(form.checkInAt);
    const checkOutIso = pktLocalToIso(form.checkOutAt);

    try {
      if (editingId) {
        const record = items.find((item) => item.id === editingId);
        const overtimeMinutes = form.overtimeSeconds.trim();
        const overtimeStartedIso = pktLocalToIso(form.overtimeStartedAt);
        const overtimeEndedIso = pktLocalToIso(form.overtimeEndedAt);
        const overtimeChanged =
          overtimeMinutes !==
            (record?.overtimeSeconds != null
              ? String(Math.floor(record.overtimeSeconds / 60))
              : "") ||
          overtimeStartedIso !== (record?.overtimeStartedAt ?? null) ||
          overtimeEndedIso !== (record?.overtimeEndedAt ?? null);

        await toastAsync(
          updateAttendanceAction(editingId, {
            status: form.status,
            checkInAt: checkInIso,
            checkOutAt: checkOutIso,
            notes: form.notes || null,
            ...(overtimeChanged
              ? {
                  overtimeStartedAt: overtimeStartedIso,
                  overtimeEndedAt: overtimeEndedIso,
                  overtimeSeconds: overtimeMinutes
                    ? Number.parseInt(overtimeMinutes, 10) * 60
                    : undefined,
                }
              : {}),
          }).then((result) => {
            if (!result.ok) {
              throw new Error(result.error);
            }
          }),
          {
            loading: "Saving attendance…",
            success: "Attendance updated.",
          },
        );
      } else {
        if (!form.employeeId) {
          toastError("Select an employee.");
          return;
        }

        await toastAsync(
          createAttendanceAction({
            employeeId: form.employeeId,
            shiftDate: form.shiftDate,
            status: form.status,
            checkInAt: checkInIso,
            checkOutAt: checkOutIso,
            notes: form.notes || null,
          }).then((result) => {
            if (!result.ok) {
              throw new Error(result.error);
            }
          }),
          {
            loading: "Creating attendance record…",
            success: "Attendance record created.",
          },
        );
      }

      closeForm();
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkStatus(id: string, status: AttendanceStatus) {
    try {
      await toastAsync(
        markAttendanceStatusAction(id, status).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Updating status…",
          success: `Marked as ${status}.`,
        },
      );
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error toast
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this attendance record? This cannot be undone.")) {
      return;
    }

    try {
      await toastAsync(
        deleteAttendanceAction(id).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Deleting attendance record…",
          success: "Attendance record deleted.",
        },
      );
      startTransition(() => router.refresh());
    } catch {
      // toastAsync already surfaced the error toast
    }
  }

  return (
    <div className="flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden">
      <div className="shrink-0 space-y-4">
        <AttendanceFilters
          filters={filters}
          onFiltersChange={applyFilters}
          employees={employees}
          onAddRecord={openCreate}
        />

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
          {isPending ? "Loading…" : `${items.length} record${items.length === 1 ? "" : "s"}`}
        </p>
      </div>

      <AttendanceTable
        className="md:min-h-0 md:flex-1"
        items={items}
        loading={isPending}
        onEdit={openEdit}
        onMarkStatus={handleMarkStatus}
        onDelete={handleDelete}
        resetDeps={[filters.from, filters.to, filters.employeeId, filters.status]}
      />
    </div>
  );
}
