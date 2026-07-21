"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  emptySalarySlipForm,
  SalarySlipForm,
  type SalarySlipFormValues,
} from "@/components/accounting/salary-slip-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { createSalarySlipAction } from "@/lib/accounting/actions";
import type { SalaryCalculationResult } from "@/lib/accounting/calculations";
import type { SerializedCompensationListItem } from "@/lib/accounting/types";
import { toastAsync } from "@/lib/toast";

type CreateSalarySlipSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: SerializedCompensationListItem[];
  defaultYearMonth: string;
  companyName: string;
};

function parseAmount(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function CreateSalarySlipSheet({
  open,
  onOpenChange,
  employees,
  defaultYearMonth,
  companyName,
}: CreateSalarySlipSheetProps) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [yearMonth, setYearMonth] = useState(defaultYearMonth);
  const [form, setForm] = useState<SalarySlipFormValues>(emptySalarySlipForm);
  const [preview, setPreview] = useState<SalaryCalculationResult | null>(null);
  const [saving, setSaving] = useState(false);

  const employeeItems = useMemo(() => {
    const items: Record<string, string> = {};
    for (const employee of employees) {
      items[employee.employeeId] = `${employee.fullName} (${employee.employeeCode})`;
    }
    return items;
  }, [employees]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setYearMonth(defaultYearMonth);
    setEmployeeId(employees[0]?.employeeId ?? "");
    setForm(emptySalarySlipForm);
    setPreview(null);
  }, [open, defaultYearMonth, employees]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!employeeId) {
      return;
    }

    setSaving(true);
    try {
      const result = await toastAsync(
        createSalarySlipAction({
          employeeId,
          yearMonth,
          incomeTaxPkr: parseAmount(form.incomeTaxPkr),
          additionalDeductionPkr: parseAmount(form.additionalDeductionPkr),
          deductionDetails: form.deductionDetails.trim() || null,
          otherPayPkr: parseAmount(form.otherPayPkr),
          incrementPkr: parseAmount(form.incrementPkr),
          otherPayableDetails: form.otherPayableDetails.trim() || null,
        }).then((actionResult) => {
          if (!actionResult.ok) {
            throw new Error(actionResult.error);
          }
          return actionResult;
        }),
        {
          loading: "Creating salary slip…",
          success: "Salary slip created.",
        },
      );

      onOpenChange(false);
      router.push(`/admin/accounting/salary-slips/${result.data.id}`);
      router.refresh();
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Create salary slip</SheetTitle>
          <SheetDescription>
            Generate a monthly slip for {companyName}. Attendance and compensation snapshots are
            calculated on save.
          </SheetDescription>
        </SheetHeader>

        {employees.length === 0 ? (
          <p className="px-4 text-sm text-[#d7dceb]">
            Configure employee compensation profiles before creating salary slips.
          </p>
        ) : (
          <div className="space-y-4 px-4 pb-4">
            <div className="grid gap-4 rounded-xl border border-white/12 bg-[#050d22]/70 p-4">
              <div className="space-y-1.5">
                <Label>Employee</Label>
                <Select
                  items={employeeItems}
                  value={employeeId}
                  onValueChange={(value) => setEmployeeId(value as string)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.employeeId} value={employee.employeeId}>
                        {employee.fullName} ({employee.employeeCode})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-slip-month">Month</Label>
                <input
                  id="create-slip-month"
                  type="month"
                  className="flex h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/40"
                  value={yearMonth}
                  onChange={(event) => setYearMonth(event.target.value)}
                />
              </div>
            </div>

            {employeeId ? (
              <SalarySlipForm
                employeeId={employeeId}
                yearMonth={yearMonth}
                form={form}
                onFormChange={setForm}
                preview={preview}
                onPreviewChange={setPreview}
                saving={saving}
                onSubmit={handleSubmit}
                onCancel={() => onOpenChange(false)}
                submitLabel="Create slip"
              />
            ) : null}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
