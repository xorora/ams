"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  AttendanceFilters,
  type AttendanceFiltersState,
} from "@/components/attendance/attendance-filters";
import {
  type AttendanceFormValues,
  type AttendanceStatus,
  attendanceToForm,
  emptyAttendanceForm,
  pktLocalToIso,
} from "@/components/attendance/attendance-sheet";
import { AttendanceTable } from "@/components/attendance/attendance-table";
import {
  createAttendanceAction,
  deleteAttendanceAction,
  fixLateGraceMinuteCheckInsAction,
  markAttendanceStatusAction,
  updateAttendanceAction,
} from "@/lib/admin/actions";
import { attendanceListQuery, normalizeAttendanceDateRange } from "@/lib/admin/query-params";
import type { SerializedAttendance, SerializedEmployeeOption } from "@/lib/admin/serialize";
import { toastAsync, toastError } from "@/lib/toast";
import { Button } from "@/components/ui/button";

const AttendanceSheet = dynamic(
  () => import("@/components/attendance/attendance-sheet").then((module) => module.AttendanceSheet),
  { loading: () => null },
);

type AttendanceManagerProps = {
  employees: SerializedEmployeeOption[];
  items: SerializedAttendance[];
  filters: AttendanceFiltersState;
  page: number;
  limit: number;
  total: number;
};

export function AttendanceManager({
  employees,
  items,
  filters: initialFilters,
  page,
  limit,
  total,
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

  function navigateWithFilters(next: AttendanceFiltersState) {
    startTransition(() => {
      router.replace(
        `/admin/attendance${attendanceListQuery({
          from: next.from,
          to: next.to,
          employeeId: next.employeeId || undefined,
          status: next.status || undefined,
          page: next.page,
          limit: next.limit,
        })}`,
      );
    });
  }

  function applyFilters(updater: React.SetStateAction<AttendanceFiltersState>) {
    setFilters((current) => {
      const nextRaw = typeof updater === "function" ? updater(current) : updater;
      const { from, to } = normalizeAttendanceDateRange(nextRaw.from, nextRaw.to);
      const next = { ...nextRaw, from, to, page: 1 };
      navigateWithFilters(next);
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
        await toastAsync(
          updateAttendanceAction(editingId, {
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

  async function handleFixGraceMinuteLates() {
    if (
      !window.confirm(
        "Clear late flags for check-ins during the grace minute (e.g. 09:15 / 15:15 / 18:15)? Those arrivals are on-time under the updated rule.",
      )
    ) {
      return;
    }

    try {
      await toastAsync(
        fixLateGraceMinuteCheckInsAction().then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
          return result.data.updated;
        }),
        {
          loading: "Updating late flags…",
          success: (updated) =>
            updated === 0
              ? "No grace-minute late records found."
              : `Updated ${updated} record${updated === 1 ? "" : "s"} to on-time.`,
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

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleFixGraceMinuteLates}>
            Clear late for :15 arrivals
          </Button>
          <p className="text-muted-foreground text-xs">
            One-time cleanup after the inclusive grace-minute rule (09:15 / 15:15 / 18:15 = on time).
          </p>
        </div>

        <AttendanceSheet
          open={formOpen}
          onOpenChange={(open) => {
            if (!open) {
              closeForm();
            } else {
              setFormOpen(true);
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
          {isPending
            ? "Loading…"
            : `${total} record${total === 1 ? "" : "s"}`}
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
        page={page}
        pageSize={limit}
        totalItems={total}
        onPageChange={(nextPage) => {
          const next = { ...filters, page: nextPage, limit };
          setFilters(next);
          navigateWithFilters(next);
        }}
        onPageSizeChange={(nextLimit) => {
          const next = { ...filters, page: 1, limit: nextLimit };
          setFilters(next);
          navigateWithFilters(next);
        }}
      />
    </div>
  );
}
