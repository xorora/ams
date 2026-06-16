"use client";

import { LeaveFormDocument } from "@/components/leave/leave-form-document";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SerializedLeaveRequest } from "@/lib/leave/serialize";
import type { LeaveBalance } from "@/lib/leave/types";

type LeaveDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: SerializedLeaveRequest | null;
  companyName: string;
  designation?: string | null;
  department?: string | null;
  balances: LeaveBalance[];
};

export function LeaveDetailSheet({
  open,
  onOpenChange,
  request,
  companyName,
  designation,
  department,
  balances,
}: LeaveDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-[880px]">
        <SheetHeader>
          <SheetTitle>Leave request</SheetTitle>
        </SheetHeader>

        {request ? (
          <div className="flex-1 overflow-y-auto px-1 pb-4">
            <LeaveFormDocument
              mode="view"
              companyName={companyName}
              employeeName={request.employeeName}
              designation={designation ?? request.employeeDesignation}
              department={department ?? request.employeeDepartment}
              balances={balances}
              leaveType={request.leaveType}
              startDate={request.startDate}
              endDate={request.endDate}
              daysCount={request.daysCount}
              reason={request.reason}
              medicalCertificateNote={request.medicalCertificateNote}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
