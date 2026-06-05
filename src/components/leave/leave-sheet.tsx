"use client";

import { formatInTimeZone } from "date-fns-tz";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import { LEAVE_ENTITLEMENTS } from "@/lib/leave/constants";
import { leaveTypeLabel } from "@/lib/leave/display";
import type { LeaveType } from "@/lib/leave/types";

export type LeaveFormValues = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  medicalCertificateNote: string;
};

export function emptyLeaveForm(): LeaveFormValues {
  const today = formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy-MM-dd");
  return {
    leaveType: "annual",
    startDate: today,
    endDate: today,
    reason: "",
    medicalCertificateNote: "",
  };
}

type LeaveSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: LeaveFormValues;
  onFormChange: (updater: (values: LeaveFormValues) => LeaveFormValues) => void;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
};

export function LeaveSheet({
  open,
  onOpenChange,
  form,
  onFormChange,
  saving,
  onSubmit,
  onCancel,
}: LeaveSheetProps) {
  const config = LEAVE_ENTITLEMENTS[form.leaveType];
  const _unitLabel = config.workingDaysOnly ? "working days" : "days";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Apply for leave</SheetTitle>
          <SheetDescription>
            Submit a leave request. Annual leave is approved immediately; casual and sick leave
            require admin approval.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="leave-type">Leave type</Label>
            <Select
              value={form.leaveType}
              onValueChange={(value) =>
                onFormChange((current) => ({ ...current, leaveType: value as LeaveType }))
              }
            >
              <SelectTrigger id="leave-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["annual", "casual", "sick"] as LeaveType[]).map((type) => {
                  const typeConfig = LEAVE_ENTITLEMENTS[type];
                  const typeUnit = typeConfig.workingDaysOnly ? "working days" : "days";
                  return (
                    <SelectItem key={type} value={type}>
                      {leaveTypeLabel(type)} ({typeConfig.annualDays} {typeUnit}/yr)
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Start date</Label>
            <DatePicker
              value={form.startDate}
              onChange={(value) =>
                onFormChange((current) => ({
                  ...current,
                  startDate: value,
                  endDate: value > current.endDate ? value : current.endDate,
                }))
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>End date</Label>
            <DatePicker
              value={form.endDate}
              onChange={(value) => onFormChange((current) => ({ ...current, endDate: value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reason">Reason</Label>
            <textarea
              id="reason"
              required
              rows={3}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              value={form.reason}
              onChange={(event) =>
                onFormChange((current) => ({ ...current, reason: event.target.value }))
              }
            />
          </div>

          {config.requiresMedicalCertificate ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="medical-certificate">Medical certificate</Label>
              <Input
                id="medical-certificate"
                required
                placeholder="Certificate reference or details"
                value={form.medicalCertificateNote}
                onChange={(event) =>
                  onFormChange((current) => ({
                    ...current,
                    medicalCertificateNote: event.target.value,
                  }))
                }
              />
              <p className="text-muted-foreground text-xs">
                Sick leave requires a medical certificate. Provide the certificate number or a note
                confirming it will be submitted.
              </p>
            </div>
          ) : null}

          <p className="text-muted-foreground text-xs">
            {config.workingDaysOnly
              ? "Annual leave counts weekdays only (Mon–Fri)."
              : "This leave type counts all calendar days in the selected range."}
          </p>
        </form>

        <SheetFooter className="flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving} onClick={onSubmit}>
            {saving ? "Submitting…" : "Submit request"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
