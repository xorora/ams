"use client";

import { Button } from "@/components/ui/button";
import { FormField, FormSection } from "@/components/ui/form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UpsertCompensationInput } from "@/lib/accounting/compensation-service";
import { formatYearMonthShort } from "@/lib/accounting/format";

export type CompensationFormValues = {
  grossSalaryPkr: string;
  basicSalaryPkr: string;
  conveyanceAllowancePkr: string;
  adhocPkr: string;
  hrAllowancePkr: string;
  medicalAllowancePkr: string;
  bankName: string;
  bankAccountNumber: string;
  fixedSecurityDeductionPkr: string;
  fixedOtherPayPkr: string;
  incomeTaxPkr: string;
};

export const emptyCompensationForm: CompensationFormValues = {
  grossSalaryPkr: "",
  basicSalaryPkr: "0",
  conveyanceAllowancePkr: "0",
  adhocPkr: "0",
  hrAllowancePkr: "0",
  medicalAllowancePkr: "0",
  bankName: "",
  bankAccountNumber: "",
  fixedSecurityDeductionPkr: "0",
  fixedOtherPayPkr: "0",
  incomeTaxPkr: "0",
};

export function compensationToForm(record?: {
  grossSalaryPkr: number;
  basicSalaryPkr: number;
  conveyanceAllowancePkr: number;
  adhocPkr?: number;
  hrAllowancePkr?: number;
  medicalAllowancePkr?: number;
  bankName: string | null;
  bankAccountNumber: string | null;
  fixedSecurityDeductionPkr: number;
  fixedOtherPayPkr: number;
}, incomeTaxPkr = 0): CompensationFormValues {
  if (!record) {
    return { ...emptyCompensationForm, incomeTaxPkr: String(incomeTaxPkr) };
  }

  return {
    grossSalaryPkr: String(record.grossSalaryPkr),
    basicSalaryPkr: String(record.basicSalaryPkr),
    conveyanceAllowancePkr: String(record.conveyanceAllowancePkr),
    adhocPkr: String(record.adhocPkr ?? 0),
    hrAllowancePkr: String(record.hrAllowancePkr ?? 0),
    medicalAllowancePkr: String(record.medicalAllowancePkr ?? 0),
    bankName: record.bankName ?? "",
    bankAccountNumber: record.bankAccountNumber ?? "",
    fixedSecurityDeductionPkr: String(record.fixedSecurityDeductionPkr),
    fixedOtherPayPkr: String(record.fixedOtherPayPkr),
    incomeTaxPkr: String(incomeTaxPkr),
  };
}

export function compensationFormToInput(form: CompensationFormValues): UpsertCompensationInput {
  return {
    grossSalaryPkr: Number.parseInt(form.grossSalaryPkr, 10),
    basicSalaryPkr: Number.parseInt(form.basicSalaryPkr, 10) || 0,
    conveyanceAllowancePkr: Number.parseInt(form.conveyanceAllowancePkr, 10) || 0,
    adhocPkr: Number.parseInt(form.adhocPkr, 10) || 0,
    hrAllowancePkr: Number.parseInt(form.hrAllowancePkr, 10) || 0,
    medicalAllowancePkr: Number.parseInt(form.medicalAllowancePkr, 10) || 0,
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
  yearMonth?: string;
};

export function CompensationForm({
  employeeName,
  employeeCode,
  form,
  onFormChange,
  saving = false,
  onSubmit,
  onCancel,
  yearMonth,
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
        {yearMonth ? (
          <p className="mt-1 text-[#9aa3b8]">Month: {formatYearMonthShort(yearMonth)}</p>
        ) : null}
      </div>

      <FormSection
        title="Compensation"
        description="Gross, basic, ADHOC, and allowances used on the salary sheet."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField className="sm:col-span-2">
            <Label htmlFor="gross-salary">Gross Monthly Salary (PKR)</Label>
            <Input
              id="gross-salary"
              inputMode="numeric"
              required
              value={form.grossSalaryPkr}
              onChange={(event) => updateField("grossSalaryPkr", event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="basic-salary">Basic Salary (PKR)</Label>
            <Input
              id="basic-salary"
              inputMode="numeric"
              value={form.basicSalaryPkr}
              onChange={(event) => updateField("basicSalaryPkr", event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="adhoc">ADHOC (PKR)</Label>
            <Input
              id="adhoc"
              inputMode="numeric"
              value={form.adhocPkr}
              onChange={(event) => updateField("adhocPkr", event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="hr-allowance">HR Allowance (PKR)</Label>
            <Input
              id="hr-allowance"
              inputMode="numeric"
              value={form.hrAllowancePkr}
              onChange={(event) => updateField("hrAllowancePkr", event.target.value)}
            />
          </FormField>
          <FormField>
            <Label htmlFor="medical-allowance">Medical Allowance (PKR)</Label>
            <Input
              id="medical-allowance"
              inputMode="numeric"
              value={form.medicalAllowancePkr}
              onChange={(event) => updateField("medicalAllowancePkr", event.target.value)}
            />
          </FormField>
          {yearMonth ? (
            <FormField className="sm:col-span-2">
              <Label htmlFor="income-tax">Monthly Income Tax (PKR)</Label>
              <Input
                id="income-tax"
                inputMode="numeric"
                value={form.incomeTaxPkr}
                onChange={(event) => updateField("incomeTaxPkr", event.target.value)}
              />
            </FormField>
          ) : null}
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
