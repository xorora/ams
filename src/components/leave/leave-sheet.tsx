"use client";

import { formatInTimeZone } from "date-fns-tz";
import { LeaveFormDocument, type LeaveFormValues } from "@/components/leave/leave-form-document";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import type { LeaveBalance } from "@/lib/leave/types";

export type { LeaveFormValues };

export function emptyLeaveForm(
  leaveType: LeaveFormValues["leaveType"] = "annual",
): LeaveFormValues {
  const today = formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "yyyy-MM-dd");
  return {
    leaveType,
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
  companyName: string;
  companySlug?: string;
  employeeName: string;
  designation?: string | null;
  department?: string | null;
  balances: LeaveBalance[];
  probationUnpaidOnly?: boolean;
};

export function LeaveSheet({
  open,
  onOpenChange,
  form,
  onFormChange,
  saving,
  onSubmit,
  onCancel,
  companyName,
  companySlug,
  employeeName,
  designation,
  department,
  balances,
  probationUnpaidOnly = false,
}: LeaveSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-[880px]">
        <SheetHeader>
          <SheetTitle>
            {probationUnpaidOnly ? "Apply for emergency unpaid leave" : "Apply for leave"}
          </SheetTitle>
        </SheetHeader>

        <form
          id="leave-application-form"
          onSubmit={onSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-1"
        >
          <LeaveFormDocument
            mode="apply"
            companyName={companyName}
            companySlug={companySlug}
            employeeName={employeeName}
            designation={designation}
            department={department}
            balances={balances}
            form={form}
            onFormChange={onFormChange}
            probationUnpaidOnly={probationUnpaidOnly}
          />
        </form>

        <SheetFooter className="flex-row gap-2 sm:justify-end">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="leave-application-form" disabled={saving}>
            {saving ? "Submitting…" : "Submit request"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
