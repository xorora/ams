"use client";

import { OvertimeFormDocument } from "@/components/overtime/overtime-form-document";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SerializedOvertimeRequest } from "@/lib/overtime/serialize";

type OvertimeDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: SerializedOvertimeRequest | null;
};

export function OvertimeDetailSheet({ open, onOpenChange, request }: OvertimeDetailSheetProps) {
  if (!request) {
    return null;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-[880px]">
        <SheetHeader>
          <SheetTitle>Overtime request — {request.shiftDate}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-1">
          <OvertimeFormDocument
            mode="view"
            employeeName={request.employeeName}
            designation={request.employeeDesignation}
            shiftDate={request.shiftDate}
            checkInAt={request.checkInAt}
            checkOutAt={request.checkOutAt}
            overtimeStartedAt={request.overtimeStartedAt}
            overtimeEndedAt={request.overtimeEndedAt}
            overtimeSeconds={request.overtimeSeconds}
            workDescription={request.workDescription}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
