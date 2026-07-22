"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  CompensationForm,
  type CompensationFormValues,
  compensationFormToInput,
  compensationToForm,
  emptyCompensationForm,
} from "@/components/accounting/compensation-form";
import { upsertCompensationAction } from "@/lib/accounting/actions";
import type { SerializedCompensation } from "@/lib/accounting/types";
import { toastAsync } from "@/lib/toast";

type CompensationEditorProps = {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  compensation: SerializedCompensation | null;
  yearMonth?: string;
  incomeTaxPkr?: number;
};

export function CompensationEditor({
  employeeId,
  employeeName,
  employeeCode,
  compensation,
  yearMonth,
  incomeTaxPkr = 0,
}: CompensationEditorProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [form, setForm] = useState<CompensationFormValues>(emptyCompensationForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(compensationToForm(compensation ?? undefined, incomeTaxPkr));
  }, [compensation, incomeTaxPkr]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);

    try {
      const incomeTax = Number.parseInt(form.incomeTaxPkr, 10) || 0;
      await toastAsync(
        upsertCompensationAction(employeeId, compensationFormToInput(form), {
          yearMonth,
          incomeTaxPkr: yearMonth ? incomeTax : undefined,
        }).then((result) => {
          if (!result.ok) {
            throw new Error(result.error);
          }
        }),
        {
          loading: "Saving compensation…",
          success: "Compensation profile saved.",
        },
      );
      startTransition(() => {
        const query = yearMonth ? `?yearMonth=${encodeURIComponent(yearMonth)}` : "";
        router.push(`/admin/accounting/compensation${query}`);
        router.refresh();
      });
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSaving(false);
    }
  }

  return (
    <CompensationForm
      employeeName={employeeName}
      employeeCode={employeeCode}
      form={form}
      onFormChange={setForm}
      saving={saving}
      onSubmit={handleSubmit}
      yearMonth={yearMonth}
      onCancel={() => {
        const query = yearMonth ? `?yearMonth=${encodeURIComponent(yearMonth)}` : "";
        router.push(`/admin/accounting/compensation${query}`);
      }}
    />
  );
}
