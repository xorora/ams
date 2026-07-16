"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { leaveStatusBadgeVariant, leaveStatusLabel, leaveTypeLabel } from "@/lib/leave/display";
import type { SerializedLeaveRequest } from "@/lib/leave/serialize";

type LeaveTableProps = {
  requests: SerializedLeaveRequest[];
  loading?: boolean;
  showEmployee?: boolean;
  onView?: (request: SerializedLeaveRequest) => void;
  onCancel?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDownloadPdf?: (id: string) => void;
  downloadPending?: boolean;
  actionPending?: boolean;
  resetDeps?: readonly unknown[];
  className?: string;
};

export function LeaveTable({
  requests,
  loading = false,
  showEmployee = false,
  onView,
  onCancel,
  onApprove,
  onReject,
  onDelete,
  onDownloadPdf,
  downloadPending = false,
  actionPending = false,
  resetDeps,
  className,
}: LeaveTableProps) {
  const columns = useMemo<ColumnDef<SerializedLeaveRequest>[]>(() => {
    const baseColumns: ColumnDef<SerializedLeaveRequest>[] = [];

    if (showEmployee) {
      baseColumns.push(
        {
          accessorKey: "employeeCode",
          header: "Code",
          cell: ({ row }) => <span className="font-mono text-xs">{row.original.employeeCode}</span>,
        },
        {
          accessorKey: "employeeName",
          header: "Employee",
          cell: ({ row }) => <span className="font-medium">{row.original.employeeName}</span>,
        },
      );
    }

    baseColumns.push(
      {
        accessorKey: "leaveType",
        header: "Type",
        cell: ({ row }) => leaveTypeLabel(row.original.leaveType),
      },
      {
        accessorKey: "startDate",
        header: "From",
        cell: ({ row }) => <span className="tabular-nums">{row.original.startDate}</span>,
      },
      {
        accessorKey: "endDate",
        header: "To",
        cell: ({ row }) => <span className="tabular-nums">{row.original.endDate}</span>,
      },
      {
        accessorKey: "daysCount",
        header: "Days",
        cell: ({ row }) => <span className="tabular-nums">{row.original.daysCount}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={leaveStatusBadgeVariant(row.original.status)}>
            {leaveStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate" title={row.original.reason}>
            {row.original.reason}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const request = row.original;
          const hasReviewActions =
            request.status === "pending" && (onCancel || onApprove || onReject);
          const canDelete = Boolean(onDelete);
          const hasSecondaryActions =
            Boolean(onDownloadPdf) || hasReviewActions || canDelete;

          if (!onView && !hasSecondaryActions) {
            return "—";
          }

          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Open actions menu"
                    disabled={actionPending || downloadPending}
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView ? (
                  <DropdownMenuItem onClick={() => onView(request)}>View</DropdownMenuItem>
                ) : null}
                {onView && hasSecondaryActions ? <DropdownMenuSeparator /> : null}
                {onDownloadPdf ? (
                  <DropdownMenuItem
                    disabled={downloadPending}
                    onClick={() => onDownloadPdf(request.id)}
                  >
                    Download PDF
                  </DropdownMenuItem>
                ) : null}
                {onDownloadPdf && (hasReviewActions || canDelete) ? (
                  <DropdownMenuSeparator />
                ) : null}
                {onCancel ? (
                  <DropdownMenuItem disabled={actionPending} onClick={() => onCancel(request.id)}>
                    Cancel
                  </DropdownMenuItem>
                ) : null}
                {onApprove ? (
                  <DropdownMenuItem disabled={actionPending} onClick={() => onApprove(request.id)}>
                    Approve
                  </DropdownMenuItem>
                ) : null}
                {onReject ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={actionPending}
                      onClick={() => onReject(request.id)}
                    >
                      Reject
                    </DropdownMenuItem>
                  </>
                ) : null}
                {onDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={actionPending}
                      onClick={() => onDelete(request.id)}
                    >
                      Delete & restore balance
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    );

    return baseColumns;
  }, [
    actionPending,
    downloadPending,
    onApprove,
    onCancel,
    onDelete,
    onDownloadPdf,
    onReject,
    onView,
    showEmployee,
  ]);

  return (
    <DataTable
      className={className}
      columns={columns}
      data={requests}
      loading={loading}
      emptyMessage="No leave requests found."
      resetDeps={resetDeps}
    />
  );
}
