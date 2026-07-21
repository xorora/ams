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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { EmployeeShiftPreset } from "@/lib/attendance/company-shift";

export type EmployeeFormValues = {
  employeeCode: string;
  fullName: string;
  email: string;
  department: string;
  designation: string;
  probationEnabled: boolean;
  probationCompleted: boolean;
  probationStartDate: string;
  probationPeriodMonths: string;
  shiftPreset: EmployeeShiftPreset;
  /** Optional; leave blank when editing to keep the existing password. */
  password: string;
};

export type ShiftPresetCompany = "xorora" | "crest-led";

export const emptyEmployeeForm: EmployeeFormValues = {
  employeeCode: "",
  fullName: "",
  email: "",
  department: "",
  designation: "",
  probationEnabled: false,
  probationCompleted: false,
  probationStartDate: getTodayPkt(),
  probationPeriodMonths: String(DEFAULT_PROBATION_PERIOD_MONTHS),
  shiftPreset: "afternoon",
  password: "",
};

export function emptyEmployeeFormForCompany(
  company: ShiftPresetCompany | null | undefined,
): EmployeeFormValues {
  return {
    ...emptyEmployeeForm,
    shiftPreset: company === "crest-led" ? "day" : "afternoon",
  };
}

export function employeeToForm(
  employee: SerializedEmployee,
  company: ShiftPresetCompany | null | undefined = null,
): EmployeeFormValues {
  const fallback: EmployeeShiftPreset = company === "crest-led" ? "day" : "afternoon";
  const shiftPreset: EmployeeShiftPreset =
    employee.shiftPreset === "evening" ||
    employee.shiftPreset === "afternoon" ||
    employee.shiftPreset === "day"
      ? employee.shiftPreset
      : fallback;

  return {
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    email: employee.email,
    department: employee.department ?? "",
    designation: employee.designation ?? "",
    probationEnabled: isCurrentlyOnProbation(employee),
    probationCompleted: isProbationCompleted(employee),
    probationStartDate: employee.probationStartDate ?? getTodayPkt(),
    probationPeriodMonths: String(employee.probationPeriodMonths),
    shiftPreset,
    password: "",
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
  /** When set, show per-employee shift timing for that company. */
  shiftPresetCompany?: ShiftPresetCompany | null;
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
  shiftPresetCompany = null,
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
              ? "Update employee details. Email must stay unique. Set a password to enable email sign-in."
              : "Add a new employee. Optionally set a password so they can sign in with email."}
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
            <Label htmlFor="employee-password">
              {editingId ? "Password (optional)" : "Password (optional)"}
            </Label>
            <Input
              id="employee-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              placeholder={editingId ? "Leave blank to keep current password" : "Min. 8 characters"}
              value={form.password}
              onChange={(e) => onFormChange((f) => ({ ...f, password: e.target.value }))}
            />
            <p className="text-muted-foreground text-xs">
              Used for email sign-in. Employees can also set a password when they first link their
              account.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="designation">Designation</Label>
            <Input
              id="designation"
              value={form.designation}
              onChange={(e) => onFormChange((f) => ({ ...f, designation: e.target.value }))}
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

          {shiftPresetCompany === "xorora" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shift-preset">Shift timing</Label>
              <Select
                items={{
                  afternoon: "Afternoon — 3:00 PM to 12:00 AM (+15 min grace)",
                  evening: "Evening — 6:00 PM to 3:00 AM (+15 min grace)",
                }}
                value={form.shiftPreset === "evening" ? "evening" : "afternoon"}
                onValueChange={(value) =>
                  onFormChange((f) => ({
                    ...f,
                    shiftPreset: value === "evening" ? "evening" : "afternoon",
                  }))
                }
              >
                <SelectTrigger id="shift-preset" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="afternoon">
                    Afternoon — 3:00 PM to 12:00 AM (+15 min grace)
                  </SelectItem>
                  <SelectItem value="evening">
                    Evening — 6:00 PM to 3:00 AM (+15 min grace)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Late starts one minute after the grace deadline.
              </p>
            </div>
          ) : null}

          {shiftPresetCompany === "crest-led" ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="shift-preset">Shift timing</Label>
              <Select
                items={{
                  day: "Day — 9:00 AM to 5:00 PM (+15 min grace)",
                  evening: "Evening — 6:00 PM to 3:00 AM (+15 min grace)",
                }}
                value={form.shiftPreset === "evening" ? "evening" : "day"}
                onValueChange={(value) =>
                  onFormChange((f) => ({
                    ...f,
                    shiftPreset: value === "evening" ? "evening" : "day",
                  }))
                }
              >
                <SelectTrigger id="shift-preset" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day — 9:00 AM to 5:00 PM (+15 min grace)</SelectItem>
                  <SelectItem value="evening">
                    Evening — 6:00 PM to 3:00 AM (+15 min grace)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Late starts one minute after the grace deadline.
              </p>
            </div>
          ) : null}

          <Separator />

          <div className="flex flex-col gap-3">
            <div>
              <p className="font-medium text-sm">Probationary period</p>
              <p className="text-muted-foreground text-sm">
                {editingId
                  ? "Adjust probation settings for this employee. Mark legacy employees as completed if they finished probation before joining the system."
                  : `Off by default when you add an employee. Mark existing staff as completed, or enable probation for new hires.`}
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
