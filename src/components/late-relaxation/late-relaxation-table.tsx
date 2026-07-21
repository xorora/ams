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
import {
  lateRelaxationStatusBadgeVariant,
  lateRelaxationStatusLabel,
} from "@/lib/late-relaxation/display";
import type { SerializedLateRelaxationRequest } from "@/lib/late-relaxation/serialize";

type LateRelaxationTableProps = {
  requests: SerializedLateRelaxationRequest[];
  showEmployee?: boolean;
  onView?: (request: SerializedLateRelaxationRequest) => void;
  onCancel?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  actionPending?: boolean;
  className?: string;
};

export function LateRelaxationTable({
  requests,
  showEmployee = false,
  onView,
  onCancel,
  onApprove,
  onReject,
  actionPending = false,
  className,
}: LateRelaxationTableProps) {
  const columns = useMemo<ColumnDef<SerializedLateRelaxationRequest>[]>(() => {
    const baseColumns: ColumnDef<SerializedLateRelaxationRequest>[] = [];

    if (showEmployee) {
      baseColumns.push(
        {
          accessorKey: "employeeCode",
          header: "Code",
          cell: ({ row }) => (
            <span className="font-mono text-xs">{row.original.employeeCode}</span>
          ),
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
        accessorKey: "yearMonth",
        header: "Month",
        cell: ({ row }) => <span className="tabular-nums">{row.original.yearMonth}</span>,
      },
      {
        accessorKey: "lateCountAtRequest",
        header: "Lates",
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.lateCountAtRequest}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={lateRelaxationStatusBadgeVariant(row.original.status)}>
            {lateRelaxationStatusLabel(row.original.status)}
          </Badge>
        ),
      },
      {
        accessorKey: "reason",
        header: "Reason",
        cell: ({ row }) => (
          <span className="line-clamp-2 max-w-xs text-muted-foreground text-sm">
            {row.original.reason}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const request = row.original;
          const canCancel = Boolean(onCancel) && request.status === "pending";
          const canApprove = Boolean(onApprove) && request.status === "pending";
          const canReject = Boolean(onReject) && request.status === "pending";

          if (!onView && !canCancel && !canApprove && !canReject) {
            return null;
          }

          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-8"
                    disabled={actionPending}
                    aria-label="Open actions menu"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onView ? (
                  <DropdownMenuItem onClick={() => onView(request)}>View</DropdownMenuItem>
                ) : null}
                {canApprove || canReject || canCancel ? <DropdownMenuSeparator /> : null}
                {canApprove ? (
                  <DropdownMenuItem onClick={() => onApprove?.(request.id)}>Approve</DropdownMenuItem>
                ) : null}
                {canReject ? (
                  <DropdownMenuItem onClick={() => onReject?.(request.id)}>Reject</DropdownMenuItem>
                ) : null}
                {canCancel ? (
                  <DropdownMenuItem onClick={() => onCancel?.(request.id)}>Cancel</DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    );

    return baseColumns;
  }, [actionPending, onApprove, onCancel, onReject, onView, showEmployee]);

  return (
    <DataTable
      className={className}
      columns={columns}
      data={requests}
      emptyMessage="No late relaxation requests yet."
    />
  );
}
