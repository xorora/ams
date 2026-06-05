"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DEFAULT_PROBATION_PERIOD_MONTHS,
  formatProbationEndDate,
  getProbationDaysSpent,
  getProbationTotalDays,
  getTodayPkt,
  isCurrentlyOnProbation,
  isProbationCompleted,
} from "@/lib/admin/probation";
import type { SerializedEmployee } from "@/lib/admin/serialize";

export type EmployeeFormValues = {
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  probationEnabled: boolean;
  probationCompleted: boolean;
  probationStartDate: string;
  probationPeriodMonths: string;
};

export const emptyEmployeeForm: EmployeeFormValues = {
  employeeCode: "",
  fullName: "",
  email: "",
  department: "",
  probationEnabled: false,
  probationCompleted: false,
  probationStartDate: getTodayPkt(),
  probationPeriodMonths: String(DEFAULT_PROBATION_PERIOD_MONTHS),
};

export function employeeToForm(employee: SerializedEmployee): EmployeeFormValues {
  return {
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department ?? "",
    probationEnabled: isCurrentlyOnProbation(employee),
    probationCompleted: isProbationCompleted(employee),
    probationStartDate: employee.probationStartDate ?? getTodayPkt(),
    probationPeriodMonths: String(employee.probationPeriodMonths),
  };
}

type EmployeeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: EmployeeFormValues;
  onFormChange: React.Dispatch<React.SetStateAction<EmployeeFormValues>>;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  onStartProbation?: () => void;
  onEndProbation?: () => void;
  probationActionPending?: boolean;
};

function ProbationSummary({ form }: { form: EmployeeFormValues }) {
  const periodMonths = Number.parseInt(form.probationPeriodMonths, 10);
  if (!form.probationEnabled || !form.probationStartDate || !Number.isFinite(periodMonths)) {
    return null;
  }

  const spent = getProbationDaysSpent(form.probationStartDate);
  const total = getProbationTotalDays(form.probationStartDate, periodMonths);
  const endDate = formatProbationEndDate(form.probationStartDate, periodMonths);
  const onProbation = isCurrentlyOnProbation({
    probationEnabled: form.probationEnabled,
    probationCompleted: form.probationCompleted,
    probationStartDate: form.probationStartDate,
    probationPeriodMonths: periodMonths,
  });

  return (
    <p className="text-muted-foreground text-sm">
      {onProbation
        ? `${spent} of ${total} days completed. Ends ${endDate}.`
        : `Probation period ended on ${endDate}.`}
    </p>
  );
}

export function EmployeeSheet({
  open,
  onOpenChange,
  editingId,
  form,
  onFormChange,
  saving,
  onSubmit,
  onCancel,
  onStartProbation,
  onEndProbation,
  probationActionPending = false,
}: EmployeeSheetProps) {
  const periodMonths = Number.parseInt(form.probationPeriodMonths, 10);
  const showOnProbation =
    editingId &&
    form.probationEnabled &&
    form.probationStartDate &&
    Number.isFinite(periodMonths) &&
    isCurrentlyOnProbation({
      probationEnabled: form.probationEnabled,
      probationCompleted: form.probationCompleted,
      probationStartDate: form.probationStartDate,
      probationPeriodMonths: periodMonths,
    });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editingId ? "Edit employee" : "New employee"}</SheetTitle>
          <SheetDescription>
            {editingId
              ? "Update employee details. Email must stay unique."
              : "Add a new employee. They can sign in with their company email."}
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="employee-code">Employee code</Label>
            <Input
              id="employee-code"
              required
              value={form.employeeCode}
              onChange={(e) => onFormChange((f) => ({ ...f, employeeCode: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="full-name">Full name</Label>
            <Input
              id="full-name"
              required
              value={form.fullName}
              onChange={(e) => onFormChange((f) => ({ ...f, fullName: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              required
              type="email"
              value={form.email}
              onChange={(e) => onFormChange((f) => ({ ...f, email: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="department">Department</Label>
            <Input
              id="department"
              value={form.department}
              onChange={(e) => onFormChange((f) => ({ ...f, department: e.target.value }))}
            />
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <div>
              <p className="font-medium text-sm">Probationary period</p>
              <p className="text-muted-foreground text-sm">
                {editingId
                  ? "Adjust probation settings for this employee. Mark legacy employees as completed if they finished probation before joining the system."
                  : `Off by default when you add an employee. Mark existing staff as completed, or enable probation for new hires. Self-registered employees start with a ${DEFAULT_PROBATION_PERIOD_MONTHS}-month probation.`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="probation-completed"
                checked={form.probationCompleted}
                onCheckedChange={(checked) =>
                  onFormChange((f) => ({
                    ...f,
                    probationCompleted: checked === true,
                    probationEnabled: checked === true ? false : f.probationEnabled,
                  }))
                }
              />
              <Label htmlFor="probation-completed" className="font-normal">
                Probation already completed
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="probation-enabled"
                checked={form.probationEnabled}
                disabled={form.probationCompleted}
                onCheckedChange={(checked) =>
                  onFormChange((f) => ({
                    ...f,
                    probationEnabled: checked === true,
                    probationCompleted: checked === true ? false : f.probationCompleted,
                    probationStartDate:
                      checked === true && !f.probationStartDate
                        ? getTodayPkt()
                        : f.probationStartDate,
                  }))
                }
              />
              <Label htmlFor="probation-enabled" className="font-normal">
                Enable probationary period
              </Label>
            </div>

            {form.probationEnabled && !form.probationCompleted && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="probation-start">Start date</Label>
                  <DatePicker
                    id="probation-start"
                    value={form.probationStartDate}
                    onChange={(value) => onFormChange((f) => ({ ...f, probationStartDate: value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="probation-period">Period (months)</Label>
                  <Input
                    id="probation-period"
                    type="number"
                    min={1}
                    max={24}
                    required
                    value={form.probationPeriodMonths}
                    onChange={(e) =>
                      onFormChange((f) => ({ ...f, probationPeriodMonths: e.target.value }))
                    }
                  />
                </div>
                <ProbationSummary form={form} />
              </>
            )}

            {form.probationCompleted && (
              <p className="text-muted-foreground text-sm">
                This employee is recorded as having completed probation.
              </p>
            )}

            {editingId && (onStartProbation || onEndProbation) && !form.probationCompleted && (
              <div className="flex flex-wrap gap-2">
                {showOnProbation && onEndProbation ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={probationActionPending || saving}
                    onClick={onEndProbation}
                  >
                    End probation now
                  </Button>
                ) : null}
                {!showOnProbation && onStartProbation ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={probationActionPending || saving}
                    onClick={onStartProbation}
                  >
                    Start probation
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          <SheetFooter className="flex-row px-0">
            <Button type="submit" disabled={saving || probationActionPending}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
