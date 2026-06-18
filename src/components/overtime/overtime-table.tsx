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
import { formatShiftDuration } from "@/lib/admin/display";
import { overtimeStatusBadgeVariant, overtimeStatusLabel } from "@/lib/overtime/display";
import type { SerializedOvertimeRequest } from "@/lib/overtime/serialize";

type OvertimeTableProps = {
  requests: SerializedOvertimeRequest[];
  loading?: boolean;
  showEmployee?: boolean;
  onView?: (request: SerializedOvertimeRequest) => void;
  onCancel?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onDownloadPdf?: (id: string) => void;
  downloadPending?: boolean;
  actionPending?: boolean;
  resetDeps?: readonly unknown[];
  className?: string;
};

export function OvertimeTable({
  requests,
  loading = false,
  showEmployee = false,
  onView,
  onCancel,
  onApprove,
  onReject,
  onDownloadPdf,
  downloadPending = false,
  actionPending = false,
  resetDeps,
  className,
}: OvertimeTableProps) {
  const columns = useMemo<ColumnDef<SerializedOvertimeRequest>[]>(() => {
    const baseColumns: ColumnDef<SerializedOvertimeRequest>[] = [];

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
        accessorKey: "shiftDate",
        header: "Shift date",
        cell: ({ row }) => <span className="tabular-nums">{row.original.shiftDate}</span>,
      },
      {
        id: "overtimeSeconds",
        header: "Overtime",
        cell: ({ row }) => (
          <span className="tabular-nums">{formatShiftDuration(row.original.overtimeSeconds)}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={overtimeStatusBadgeVariant(row.original.status)}>
            {overtimeStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "workDescription",
        header: "Work description",
        cell: ({ row }) => (
          <span className="block max-w-[240px] truncate" title={row.original.workDescription}>
            {row.original.workDescription}
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
          const hasSecondaryActions = Boolean(onDownloadPdf) || hasReviewActions;

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
                    Download overtime slip
                  </DropdownMenuItem>
                ) : null}
                {onDownloadPdf && hasReviewActions ? <DropdownMenuSeparator /> : null}
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
      emptyMessage="No overtime requests found."
      resetDeps={resetDeps}
    />
  );
}
