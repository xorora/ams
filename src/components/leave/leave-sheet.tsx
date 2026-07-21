"use client";

import { formatInTimeZone } from "date-fns-tz";
import { LeaveFormDocument, type LeaveFormValues } from "@/components/leave/leave-form-document";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
      <SheetContent
        side="bottom"
        className="flex h-[min(94dvh,940px)] w-full flex-col gap-0 p-0 sm:mx-auto sm:max-w-3xl sm:rounded-t-2xl"
      >
        <SheetHeader className="shrink-0 gap-1.5 px-4 pt-1 pb-3 sm:px-6">
          <SheetTitle>
            {probationUnpaidOnly ? "Apply for emergency unpaid leave" : "Apply for leave"}
          </SheetTitle>
          <SheetDescription>
            Fill in the leave form below, then submit your request.
          </SheetDescription>
        </SheetHeader>

        <form
          id="leave-application-form"
          onSubmit={onSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-3 pb-3 sm:px-6"
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

        <SheetFooter className="shrink-0 flex-row gap-2 sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1 touch-manipulation sm:min-h-9 sm:flex-none"
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="leave-application-form"
            className="min-h-11 flex-1 touch-manipulation sm:min-h-9 sm:flex-none"
            disabled={saving}
          >
            {saving ? "Submitting…" : "Submit request"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
