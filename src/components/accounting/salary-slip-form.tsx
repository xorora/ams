"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormField, FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { previewSalarySlipAction } from "@/lib/accounting/actions";
import type { SalaryCalculationResult } from "@/lib/accounting/calculations";
import { formatSalaryPkr } from "@/lib/accounting/format";

export type SalarySlipFormValues = {
  incomeTaxPkr: string;
  additionalDeductionPkr: string;
  deductionDetails: string;
  otherPayPkr: string;
  incrementPkr: string;
  otherPayableDetails: string;
};

export const emptySalarySlipForm: SalarySlipFormValues = {
  incomeTaxPkr: "0",
  additionalDeductionPkr: "0",
  deductionDetails: "",
  otherPayPkr: "0",
  incrementPkr: "0",
  otherPayableDetails: "",
};

export function salarySlipToForm(slip: {
  incomeTaxPkr: number;
  additionalDeductionPkr: number;
  deductionDetails: string | null;
  otherPayPkr: number;
  incrementPkr: number;
  otherPayableDetails: string | null;
}): SalarySlipFormValues {
  return {
    incomeTaxPkr: String(slip.incomeTaxPkr),
    additionalDeductionPkr: String(slip.additionalDeductionPkr),
    deductionDetails: slip.deductionDetails ?? "",
    otherPayPkr: String(slip.otherPayPkr),
    incrementPkr: String(slip.incrementPkr),
    otherPayableDetails: slip.otherPayableDetails ?? "",
  };
}

function parseAmount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

type SalarySlipFormProps = {
  employeeId: string;
  yearMonth: string;
  form: SalarySlipFormValues;
  onFormChange: (form: SalarySlipFormValues) => void;
  preview?: SalaryCalculationResult | null;
  onPreviewChange?: (preview: SalaryCalculationResult | null) => void;
  saving?: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel?: () => void;
  submitLabel?: string;
};

export function SalarySlipForm({
  employeeId,
  yearMonth,
  form,
  onFormChange,
  preview,
  onPreviewChange,
  saving = false,
  onSubmit,
  onCancel,
  submitLabel = "Save slip",
}: SalarySlipFormProps) {
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!onPreviewChange) {
      return;
    }

    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      void previewSalarySlipAction({
        employeeId,
        yearMonth,
        incomeTaxPkr: parseAmount(form.incomeTaxPkr),
        additionalDeductionPkr: parseAmount(form.additionalDeductionPkr),
        otherPayPkr: parseAmount(form.otherPayPkr),
        incrementPkr: parseAmount(form.incrementPkr),
      })
        .then((result) => {
          if (result.ok) {
            onPreviewChange(result.data);
          }
        })
        .finally(() => {
          setPreviewLoading(false);
        });
    }, 400);

    return () => window.clearTimeout(timer);
  }, [employeeId, yearMonth, form, onPreviewChange]);

  function updateField<K extends keyof SalarySlipFormValues>(
    key: K,
    value: SalarySlipFormValues[K],
  ) {
    onFormChange({ ...form, [key]: value });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <FormSection title="Adjustments" description="Taxes, deductions, and other pay for this month.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField>
            <Label htmlFor="income-tax">Income tax (PKR)</Label>
            <Input
              id="income-tax"
              inputMode="numeric"
              value={form.incomeTaxPkr}
              onChange={(event) => updateField("incomeTaxPkr", event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="additional-deduction">Additional deduction (PKR)</Label>
            <Input
              id="additional-deduction"
              inputMode="numeric"
              value={form.additionalDeductionPkr}
              onChange={(event) => updateField("additionalDeductionPkr", event.target.value)}
            />
          </FormField>
          <FormField className="sm:col-span-2">
            <Label htmlFor="deduction-details">Deduction details</Label>
            <Input
              id="deduction-details"
              value={form.deductionDetails}
              onChange={(event) => updateField("deductionDetails", event.target.value)}
              placeholder="Optional notes for deductions"
            />
          </FormField>
          <FormField>
            <Label htmlFor="other-pay">Other pay this month (PKR)</Label>
            <Input
              id="other-pay"
              inputMode="numeric"
              value={form.otherPayPkr}
              onChange={(event) => updateField("otherPayPkr", event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="increment">Increment (PKR)</Label>
            <Input
              id="increment"
              inputMode="numeric"
              value={form.incrementPkr}
              onChange={(event) => updateField("incrementPkr", event.target.value)}
            />
          </FormField>
          <FormField className="sm:col-span-2">
            <Label htmlFor="other-payable-details">Other payable details</Label>
            <Input
              id="other-payable-details"
              value={form.otherPayableDetails}
              onChange={(event) => updateField("otherPayableDetails", event.target.value)}
              placeholder="Optional notes for other pay"
            />
          </FormField>
        </div>
      </FormSection>

      {preview ? (
        <div className="rounded-xl border border-white/12 bg-[#050d22]/70 p-4 text-sm text-[#eceef5]">
          <p className="mb-3 font-semibold text-white">Calculated preview</p>
          <div className="grid gap-2 text-[#d7dceb] sm:grid-cols-2">
            <p>
              Earned / deduct days: {preview.earnedDays} / {preview.deductDays}
            </p>
            <p>Cal salary: {formatSalaryPkr(preview.calculatedSalaryPkr)}</p>
            <p>Total deductions: {formatSalaryPkr(preview.totalDeductionPkr)}</p>
            <p className="font-semibold text-white">
              Net salary: {formatSalaryPkr(preview.netSalaryPkr)}
            </p>
          </div>
          {previewLoading ? (
            <p className="mt-2 text-xs text-[#c8cce0]">Updating preview…</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  );
}
