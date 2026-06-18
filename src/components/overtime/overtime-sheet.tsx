"use client";

import {
  OvertimeFormDocument,
  type OvertimeFormValues,
} from "@/components/overtime/overtime-form-document";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SerializedEligibleOvertimeDay } from "@/lib/overtime/serialize";

export type { OvertimeFormValues };

export function emptyOvertimeForm(): OvertimeFormValues {
  return { workDescription: "" };
}

type OvertimeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  day: SerializedEligibleOvertimeDay | null;
  form: OvertimeFormValues;
  onFormChange: (updater: (values: OvertimeFormValues) => OvertimeFormValues) => void;
  saving: boolean;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
  employeeName: string;
  designation?: string | null;
};

export function OvertimeSheet({
  open,
  onOpenChange,
  day,
  form,
  onFormChange,
  saving,
  onSubmit,
  onCancel,
  employeeName,
  designation,
}: OvertimeSheetProps) {
  if (!day) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-[880px]">
        <SheetHeader>
          <SheetTitle>Apply for overtime — {day.shiftDate}</SheetTitle>
        </SheetHeader>

        <form
          id="overtime-application-form"
          onSubmit={onSubmit}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-1"
        >
          <OvertimeFormDocument
            mode="apply"
            employeeName={employeeName}
            designation={designation}
            shiftDate={day.shiftDate}
            checkInAt={day.checkInAt}
            checkOutAt={day.checkOutAt}
            overtimeStartedAt={day.overtimeStartedAt}
            overtimeEndedAt={day.overtimeEndedAt}
            overtimeSeconds={day.overtimeSeconds}
            form={form}
            onFormChange={onFormChange}
          />
        </form>

        <SheetFooter className="border-t pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="overtime-application-form" disabled={saving}>
            {saving ? "Submitting…" : "Submit overtime request"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
