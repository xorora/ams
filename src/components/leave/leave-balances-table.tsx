"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ENTITLED_LEAVE_TYPES } from "@/lib/leave/constants";
import { leaveTypeLabel } from "@/lib/leave/display";
import type { EmployeeLeaveBalanceSummary, LeaveBalance } from "@/lib/leave/types";
import { cn } from "@/lib/utils";

type LeaveBalancesTableProps = {
  summaries: EmployeeLeaveBalanceSummary[];
  selectedEmployeeId?: string;
  onSelectEmployee?: (employeeId: string) => void;
  className?: string;
};

function balanceCell(balance: LeaveBalance | undefined) {
  if (!balance) {
    return "—";
  }

  return (
    <div className="space-y-0.5">
      <p className="font-medium tabular-nums">
        {balance.remaining}/{balance.entitled}
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">
        {balance.used} used
        {balance.pending > 0 ? ` · ${balance.pending} pending` : ""}
      </p>
    </div>
  );
}

export function LeaveBalancesTable({
  summaries,
  selectedEmployeeId,
  onSelectEmployee,
  className,
}: LeaveBalancesTableProps) {
  if (summaries.length === 0) {
    return <p className="text-muted-foreground text-sm">No active employees in this company.</p>;
  }

  return (
    <div className={cn("overflow-auto rounded-lg border", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            {ENTITLED_LEAVE_TYPES.map((leaveType) => (
              <TableHead key={leaveType} className="text-center">
                {leaveTypeLabel(leaveType)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {summaries.map((summary) => {
            const isSelected = summary.employeeId === selectedEmployeeId;

            return (
              <TableRow
                key={summary.employeeId}
                className={cn(onSelectEmployee && "cursor-pointer", isSelected && "bg-muted/50")}
                onClick={onSelectEmployee ? () => onSelectEmployee(summary.employeeId) : undefined}
              >
                <TableCell>
                  <div>
                    <p className="font-medium">{summary.employeeName}</p>
                    <p className="text-muted-foreground text-xs">{summary.employeeCode}</p>
                  </div>
                </TableCell>
                {ENTITLED_LEAVE_TYPES.map((leaveType) => {
                  const balance = summary.balances.find((item) => item.leaveType === leaveType);
                  return (
                    <TableCell key={leaveType} className="text-center">
                      {balanceCell(balance)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
