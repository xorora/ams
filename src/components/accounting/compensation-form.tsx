"use client";

import { Button } from "@/components/ui/button";
import { FormField, FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UpsertCompensationInput } from "@/lib/accounting/compensation-service";

export type CompensationFormValues = {
  grossSalaryPkr: string;
  bankName: string;
  bankAccountNumber: string;
  fixedSecurityDeductionPkr: string;
  fixedOtherPayPkr: string;
};

export const emptyCompensationForm: CompensationFormValues = {
  grossSalaryPkr: "",
  bankName: "",
  bankAccountNumber: "",
  fixedSecurityDeductionPkr: "0",
  fixedOtherPayPkr: "0",
};

export function compensationToForm(record?: {
  grossSalaryPkr: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  fixedSecurityDeductionPkr: number;
  fixedOtherPayPkr: number;
}): CompensationFormValues {
  if (!record) {
    return emptyCompensationForm;
  }

  return {
    grossSalaryPkr: String(record.grossSalaryPkr),
    bankName: record.bankName ?? "",
    bankAccountNumber: record.bankAccountNumber ?? "",
    fixedSecurityDeductionPkr: String(record.fixedSecurityDeductionPkr),
    fixedOtherPayPkr: String(record.fixedOtherPayPkr),
  };
}

export function compensationFormToInput(form: CompensationFormValues): UpsertCompensationInput {
  return {
    grossSalaryPkr: Number.parseInt(form.grossSalaryPkr, 10),
    bankName: form.bankName.trim() || null,
    bankAccountNumber: form.bankAccountNumber.trim() || null,
    fixedSecurityDeductionPkr: Number.parseInt(form.fixedSecurityDeductionPkr, 10) || 0,
    fixedOtherPayPkr: Number.parseInt(form.fixedOtherPayPkr, 10) || 0,
  };
}

type CompensationFormProps = {
  employeeName: string;
  employeeCode: string;
  form: CompensationFormValues;
  onFormChange: (form: CompensationFormValues) => void;
  saving?: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel?: () => void;
};

export function CompensationForm({
  employeeName,
  employeeCode,
  form,
  onFormChange,
  saving = false,
  onSubmit,
  onCancel,
}: CompensationFormProps) {
  function updateField<K extends keyof CompensationFormValues>(
    key: K,
    value: CompensationFormValues[K],
  ) {
    onFormChange({ ...form, [key]: value });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="rounded-xl border border-white/12 bg-[#050d22]/70 p-4 text-sm">
        <p className="font-semibold text-white">{employeeName}</p>
        <p className="mt-1 text-[#d7dceb]">Code: {employeeCode}</p>
      </div>

      <FormSection title="Compensation" description="Gross pay, bank details, and fixed monthly amounts.">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField className="sm:col-span-2">
            <Label htmlFor="gross-salary">Gross salary (PKR)</Label>
            <Input
              id="gross-salary"
              inputMode="numeric"
              required
              value={form.grossSalaryPkr}
              onChange={(event) => updateField("grossSalaryPkr", event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="bank-name">Bank name</Label>
            <Input
              id="bank-name"
              value={form.bankName}
              onChange={(event) => updateField("bankName", event.target.value)}
              placeholder="e.g. HBL"
            />
          </FormField>
          <FormField>
            <Label htmlFor="bank-account">Bank account number</Label>
            <Input
              id="bank-account"
              value={form.bankAccountNumber}
              onChange={(event) => updateField("bankAccountNumber", event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="security-deduction">Fixed security deduction (PKR)</Label>
            <Input
              id="security-deduction"
              inputMode="numeric"
              value={form.fixedSecurityDeductionPkr}
              onChange={(event) => updateField("fixedSecurityDeductionPkr", event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="fixed-other-pay">Fixed other pay (PKR)</Label>
            <Input
              id="fixed-other-pay"
              inputMode="numeric"
              value={form.fixedOtherPayPkr}
              onChange={(event) => updateField("fixedOtherPayPkr", event.target.value)}
            />
          </FormField>
        </div>
      </FormSection>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save compensation"}
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
