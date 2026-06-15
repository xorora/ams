"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { EmployeeFilters } from "@/components/employee/employee-filters";
import {
  type EmployeeFormValues,
  EmployeeSheet,
  employeeToForm,
  emptyEmployeeForm,
} from "@/components/employee/employee-sheet";
import { EmployeeTable } from "@/components/employee/employee-table";
import {
  createEmployeeAction,
  deactivateEmployeeAction,
  endEmployeeProbationAction,
  getEmployeeDeactivationPreviewAction,
  reactivateEmployeeAction,
  startEmployeeProbationAction,
  updateEmployeeAction,
} from "@/lib/admin/actions";
import { DEFAULT_PROBATION_PERIOD_MONTHS, getTodayPkt } from "@/lib/admin/probation";
import { employeesListQuery } from "@/lib/admin/query-params";
import type { SerializedEmployee } from "@/lib/admin/serialize";

type EmployeesManagerProps = {
  employees: SerializedEmployee[];
  search: string;
  includeInactive: boolean;
};

export function EmployeesManager({ employees, search, includeInactive }: EmployeesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchInput, setSearchInput] = useState(search);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormValues>(emptyEmployeeForm);
  const [saving, setSaving] = useState(false);
  const [probationActionPending, setProbationActionPending] = useState(false);

  useEffect(() => {
    setSearchInput(search);
  }, [search]);

  useEffect(() => {
    const href = `/admin/employees${employeesListQuery(searchInput, includeInactive)}`;
    const currentHref = `/admin/employees${employeesListQuery(search, includeInactive)}`;
    if (href === currentHref) {
      return;
    }

    const timer = window.setTimeout(() => {
      startTransition(() => {
        router.replace(href);
      });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [searchInput, includeInactive, search, router]);

  function navigateFilters(nextSearch: string, nextIncludeInactive: boolean) {
    startTransition(() => {
      router.replace(`/admin/employees${employeesListQuery(nextSearch, nextIncludeInactive)}`);
    });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyEmployeeForm);
    setFormOpen(true);
    setFeedback(null);
  }

  function openEdit(employee: SerializedEmployee) {
    setEditingId(employee.id);
    setForm(employeeToForm(employee));
    setFormOpen(true);
    setFeedback(null);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyEmployeeForm);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const periodMonths = Number.parseInt(form.probationPeriodMonths, 10);
      if (
        form.probationEnabled &&
        (!Number.isFinite(periodMonths) || periodMonths < 1 || periodMonths > 24)
      ) {
        throw new Error("Probation period must be between 1 and 24 months.");
      }

      const payload = form.probationCompleted
        ? {
            employeeCode: form.employeeCode,
            fullName: form.fullName,
            email: form.email,
            department: form.department || null,
            designation: form.designation || null,
            probationCompleted: true,
            probationEnabled: false,
            probationStartDate: null,
            probationPeriodMonths: DEFAULT_PROBATION_PERIOD_MONTHS,
          }
        : {
            employeeCode: form.employeeCode,
            fullName: form.fullName,
            email: form.email,
            department: form.department || null,
            designation: form.designation || null,
            probationCompleted: false,
            probationEnabled: form.probationEnabled,
            probationStartDate: form.probationEnabled ? form.probationStartDate : null,
            probationPeriodMonths: form.probationEnabled
              ? periodMonths
              : DEFAULT_PROBATION_PERIOD_MONTHS,
          };

      const result = editingId
        ? await updateEmployeeAction(editingId, payload)
        : await createEmployeeAction(payload);

      if (!result.ok) {
        throw new Error(result.error);
      }

      setFeedback({
        type: "success",
        text: editingId ? "Employee updated." : "Employee created.",
      });
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

  async function handleDeactivate(id: string, name: string) {
    setFeedback(null);
    try {
      const preview = await getEmployeeDeactivationPreviewAction(id);
      if (!preview.ok) {
        throw new Error(preview.error);
      }

      const { hasOpenShift, openShiftState } = preview.data;
      const stateLabel = openShiftState === "on_break" ? "on break" : "checked in";
      const message = hasOpenShift
        ? `${name} is still ${stateLabel} for today's shift. Close their shift now and deactivate them? They will no longer be able to check in.`
        : `Deactivate ${name}? They will no longer be able to check in.`;

      if (!window.confirm(message)) {
        return;
      }

      const result = await deactivateEmployeeAction(id, {
        closeOpenShift: hasOpenShift,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      setFeedback({
        type: "success",
        text: hasOpenShift
          ? "Employee deactivated and open shift closed."
          : "Employee deactivated.",
      });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Deactivate failed",
      });
    }
  }

  async function handleStartProbation(id: string, name: string): Promise<boolean> {
    setFeedback(null);
    if (
      !window.confirm(
        `Start a ${DEFAULT_PROBATION_PERIOD_MONTHS}-month probation period for ${name}?`,
      )
    ) {
      return false;
    }

    setProbationActionPending(true);
    try {
      const result = await startEmployeeProbationAction(id);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: "Probation started." });
      startTransition(() => router.refresh());
      return true;
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Start probation failed",
      });
      return false;
    } finally {
      setProbationActionPending(false);
    }
  }

  async function handleEndProbation(id: string, name: string): Promise<boolean> {
    setFeedback(null);
    if (!window.confirm(`End probation for ${name}?`)) {
      return false;
    }

    setProbationActionPending(true);
    try {
      const result = await endEmployeeProbationAction(id);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: "Probation ended." });
      startTransition(() => router.refresh());
      return true;
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "End probation failed",
      });
      return false;
    } finally {
      setProbationActionPending(false);
    }
  }

  async function handleSheetStartProbation() {
    if (!editingId) {
      return;
    }
    const employee = employees.find((item) => item.id === editingId);
    if (!employee) {
      return;
    }
    const started = await handleStartProbation(editingId, employee.fullName);
    if (!started) {
      return;
    }
    setForm((current) => ({
      ...current,
      probationEnabled: true,
      probationCompleted: false,
      probationStartDate: getTodayPkt(),
      probationPeriodMonths: String(DEFAULT_PROBATION_PERIOD_MONTHS),
    }));
  }

  async function handleSheetEndProbation() {
    if (!editingId) {
      return;
    }
    const employee = employees.find((item) => item.id === editingId);
    if (!employee) {
      return;
    }
    const ended = await handleEndProbation(editingId, employee.fullName);
    if (!ended) {
      return;
    }
    setForm((current) => ({
      ...current,
      probationEnabled: false,
      probationCompleted: true,
    }));
  }

  async function handleReactivate(id: string) {
    setFeedback(null);
    try {
      const result = await reactivateEmployeeAction(id);
      if (!result.ok) {
        throw new Error(result.error);
      }
      setFeedback({ type: "success", text: "Employee reactivated." });
      startTransition(() => router.refresh());
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Reactivate failed",
      });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EmployeeFilters
        search={searchInput}
        onSearchChange={setSearchInput}
        includeInactive={includeInactive}
        onIncludeInactiveChange={(value) => {
          setSearchInput(searchInput);
          navigateFilters(searchInput, value);
        }}
        onAddEmployee={openCreate}
      />

      {feedback && <FeedbackBanner type={feedback.type} text={feedback.text} />}

      <EmployeeSheet
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeForm();
          }
        }}
        editingId={editingId}
        form={form}
        onFormChange={setForm}
        saving={saving}
        onSubmit={handleSubmit}
        onCancel={closeForm}
        onStartProbation={editingId ? handleSheetStartProbation : undefined}
        onEndProbation={editingId ? handleSheetEndProbation : undefined}
        probationActionPending={probationActionPending}
      />

      <EmployeeTable
        employees={employees}
        loading={isPending}
        onEdit={openEdit}
        onDeactivate={handleDeactivate}
        onReactivate={handleReactivate}
        onStartProbation={handleStartProbation}
        onEndProbation={handleEndProbation}
      />
    </div>
  );
}
