"use client";

import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatPktDateTimeLong } from "@/lib/admin/display";
import { leaveStatusBadgeVariant, leaveStatusLabel, leaveTypeLabel } from "@/lib/leave/display";
import type { SerializedLeaveRequest } from "@/lib/leave/serialize";

type LeaveDetailSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: SerializedLeaveRequest | null;
  showEmployee?: boolean;
};

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function LeaveDetailSheet({
  open,
  onOpenChange,
  request,
  showEmployee = false,
}: LeaveDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Leave request</SheetTitle>
          <SheetDescription>Full details for this leave request.</SheetDescription>
        </SheetHeader>

        {request ? (
          <dl className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pb-4">
            {showEmployee ? (
              <>
                <DetailField label="Employee code">
                  <span className="font-mono">{request.employeeCode}</span>
                </DetailField>
                <DetailField label="Employee name">{request.employeeName}</DetailField>
                <DetailField label="Email">{request.employeeEmail}</DetailField>
              </>
            ) : null}

            <DetailField label="Leave type">{leaveTypeLabel(request.leaveType)}</DetailField>

            <DetailField label="Status">
              <Badge variant={leaveStatusBadgeVariant(request.status)}>
                {leaveStatusLabel(request.status)}
              </Badge>
            </DetailField>

            <div className="grid grid-cols-3 gap-4">
              <DetailField label="From">
                <span className="tabular-nums">{request.startDate}</span>
              </DetailField>
              <DetailField label="To">
                <span className="tabular-nums">{request.endDate}</span>
              </DetailField>
              <DetailField label="Days">
                <span className="tabular-nums">{request.daysCount}</span>
              </DetailField>
            </div>

            <DetailField label="Reason">
              <p className="whitespace-pre-wrap">{request.reason}</p>
            </DetailField>

            {request.medicalCertificateNote ? (
              <DetailField label="Medical certificate">
                <p className="whitespace-pre-wrap">{request.medicalCertificateNote}</p>
              </DetailField>
            ) : null}

            {request.reviewNotes ? (
              <DetailField label="Review notes">
                <p className="whitespace-pre-wrap">{request.reviewNotes}</p>
              </DetailField>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <DetailField label="Submitted">
                {formatPktDateTimeLong(request.createdAt)}
              </DetailField>
              <DetailField label="Last updated">
                {formatPktDateTimeLong(request.updatedAt)}
              </DetailField>
              {request.reviewedAt ? (
                <DetailField label="Reviewed">
                  {formatPktDateTimeLong(request.reviewedAt)}
                </DetailField>
              ) : null}
            </div>
          </dl>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
