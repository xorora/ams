"use client";

import { Button } from "@/components/ui/button";
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
      <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm">
        <p className="font-medium">{employeeName}</p>
        <p className="text-muted-foreground">Code: {employeeCode}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="gross-salary">Gross salary (PKR)</Label>
          <Input
            id="gross-salary"
            inputMode="numeric"
            required
            value={form.grossSalaryPkr}
            onChange={(event) => updateField("grossSalaryPkr", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bank-name">Bank name</Label>
          <Input
            id="bank-name"
            value={form.bankName}
            onChange={(event) => updateField("bankName", event.target.value)}
            placeholder="e.g. HBL"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bank-account">Bank account number</Label>
          <Input
            id="bank-account"
            value={form.bankAccountNumber}
            onChange={(event) => updateField("bankAccountNumber", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="security-deduction">Fixed security deduction (PKR)</Label>
          <Input
            id="security-deduction"
            inputMode="numeric"
            value={form.fixedSecurityDeductionPkr}
            onChange={(event) => updateField("fixedSecurityDeductionPkr", event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="fixed-other-pay">Fixed other pay (PKR)</Label>
          <Input
            id="fixed-other-pay"
            inputMode="numeric"
            value={form.fixedOtherPayPkr}
            onChange={(event) => updateField("fixedOtherPayPkr", event.target.value)}
          />
        </div>
      </div>

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
