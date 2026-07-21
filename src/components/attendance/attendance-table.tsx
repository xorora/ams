"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useMemo } from "react";
import type { AttendanceStatus } from "@/components/attendance/attendance-sheet";
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
  attendanceStatusBadgeVariant,
  formatAttendanceStatus,
  formatPktIso,
} from "@/lib/admin/display";
import type { SerializedAttendance } from "@/lib/admin/serialize";

type AttendanceTableProps = {
  items: SerializedAttendance[];
  loading: boolean;
  onEdit: (record: SerializedAttendance) => void;
  onMarkStatus: (id: string, status: AttendanceStatus) => void;
  onDelete: (id: string) => void;
  resetDeps?: readonly unknown[];
  className?: string;
  page?: number;
  pageSize?: number;
  totalItems?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
};

export function AttendanceTable({
  items,
  loading,
  onEdit,
  onMarkStatus,
  onDelete,
  resetDeps,
  className,
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: AttendanceTableProps) {
  const columns = useMemo<ColumnDef<SerializedAttendance>[]>(
    () => [
      {
        accessorKey: "shiftDate",
        header: "Shift date",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.shiftDate}</span>,
      },
      {
        accessorKey: "employeeName",
        header: "Employee",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge variant={attendanceStatusBadgeVariant(row.original.status)} className="capitalize">
            {formatAttendanceStatus(row.original.status)}
          </Badge>
        ),
      },
      {
        id: "checkInAt",
        header: "Check-in",
        cell: ({ row }) => <span className="text-xs">{formatPktIso(row.original.checkInAt)}</span>,
      },
      {
        id: "checkOutAt",
        header: "Check-out",
        cell: ({ row }) => <span className="text-xs">{formatPktIso(row.original.checkOutAt)}</span>,
      },
      {
        id: "flags",
        header: "Flags",
        cell: ({ row }) => (
          <span className="text-xs">
            {row.original.isLate && <span className="mr-1 text-amber-200">Late</span>}
            {row.original.isEarlyLeave && <span className="mr-1 text-amber-200">Early</span>}
            {row.original.isMissedCheckout && !row.original.checkOutAt && (
              <span className="text-muted-foreground">No checkout</span>
            )}
            {!row.original.isLate &&
              !row.original.isEarlyLeave &&
              !row.original.isMissedCheckout &&
              "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          const record = row.original;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11 md:size-8"
                    aria-label="Open actions menu"
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(record)}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMarkStatus(record.id, "present")}>
                  Mark present
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onMarkStatus(record.id, "absent")}>
                  Mark absent
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => onDelete(record.id)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    [onDelete, onEdit, onMarkStatus],
  );

  return (
    <DataTable
      className={className}
      columns={columns}
      data={items}
      loading={loading}
      emptyMessage="No attendance records match your filters."
      resetDeps={resetDeps}
      manualPagination={
        page != null &&
        pageSize != null &&
        totalItems != null &&
        onPageChange &&
        onPageSizeChange
          ? {
              page,
              pageSize,
              totalItems,
              onPageChange,
              onPageSizeChange,
            }
          : undefined
      }
    />
  );
}
