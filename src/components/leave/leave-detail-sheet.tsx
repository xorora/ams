"use client";

import { LeaveBalanceCards } from "@/components/leave/leave-balance-cards";
import { LeaveFormDocument } from "@/components/leave/leave-form-document";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { leaveStatusBadgeVariant, leaveStatusLabel } from "@/lib/leave/display";
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
  showBalanceCards?: boolean;
};

export function LeaveDetailSheet({
  open,
  onOpenChange,
  request,
  companyName,
  designation,
  department,
  balances,
  showBalanceCards = false,
}: LeaveDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-[880px]">
        <SheetHeader>
          <SheetTitle>Leave request</SheetTitle>
        </SheetHeader>

        {request ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-1 pb-4">
            <div className="space-y-2 rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground text-sm">Status</span>
                <Badge variant={leaveStatusBadgeVariant(request.status)}>
                  {leaveStatusLabel(request.status)}
                </Badge>
              </div>
              {request.reviewNotes ? (
                <p className="text-sm">
                  <span className="text-muted-foreground">Review notes: </span>
                  {request.reviewNotes}
                </p>
              ) : null}
            </div>

            {showBalanceCards && balances.length > 0 ? (
              <div className="space-y-2">
                <div>
                  <h3 className="font-medium text-sm">Leave balance</h3>
                  <p className="text-muted-foreground text-xs">
                    {request.employeeName} · remaining / entitled for the request year
                  </p>
                </div>
                <LeaveBalanceCards balances={balances} />
              </div>
            ) : null}

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
