"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { leaveStatusBadgeVariant, leaveStatusLabel, leaveTypeLabel } from "@/lib/leave/display";
import type { SerializedLeaveRequest } from "@/lib/leave/serialize";

type LeaveTableProps = {
  requests: SerializedLeaveRequest[];
  loading?: boolean;
  showEmployee?: boolean;
  onCancel?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  actionPending?: boolean;
};

export function LeaveTable({
  requests,
  loading = false,
  showEmployee = false,
  onCancel,
  onApprove,
  onReject,
  actionPending = false,
}: LeaveTableProps) {
  const colSpan = showEmployee ? 8 : 7;

  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            {showEmployee ? <TableHead>Employee</TableHead> : null}
            <TableHead>Type</TableHead>
            <TableHead>From</TableHead>
            <TableHead>To</TableHead>
            <TableHead>Days</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          ) : requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-muted-foreground">
                No leave requests found.
              </TableCell>
            </TableRow>
          ) : (
            requests.map((request) => (
              <TableRow key={request.id}>
                {showEmployee ? (
                  <TableCell>
                    <div>
                      <p className="font-medium">{request.employeeName}</p>
                      <p className="text-muted-foreground text-xs">{request.employeeCode}</p>
                    </div>
                  </TableCell>
                ) : null}
                <TableCell>{leaveTypeLabel(request.leaveType)}</TableCell>
                <TableCell className="tabular-nums">{request.startDate}</TableCell>
                <TableCell className="tabular-nums">{request.endDate}</TableCell>
                <TableCell className="tabular-nums">{request.daysCount}</TableCell>
                <TableCell>
                  <Badge variant={leaveStatusBadgeVariant(request.status)}>
                    {leaveStatusLabel(request.status)}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate" title={request.reason}>
                  {request.reason}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
                    {request.status === "pending" && onCancel ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actionPending}
                        onClick={() => onCancel(request.id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    {request.status === "pending" && onApprove ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={actionPending}
                        onClick={() => onApprove(request.id)}
                      >
                        Approve
                      </Button>
                    ) : null}
                    {request.status === "pending" && onReject ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={actionPending}
                        onClick={() => onReject(request.id)}
                      >
                        Reject
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
