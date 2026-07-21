"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import {
  attendanceStatusBadgeVariant,
  formatAttendanceStatus,
  formatBreakDuration,
  formatPktIso,
} from "@/lib/admin/display";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";
import { formatLateFinePkr } from "@/lib/attendance/late-fines-utils";

type ReportsEmployeeTableProps = {
  days: SerializedEmployeeReport["days"];
  resetDeps?: readonly unknown[];
  className?: string;
};

type ReportDayRow = SerializedEmployeeReport["days"][number];

function formatFlags(day: ReportDayRow): string {
  const flags: string[] = [];
  if (day.isLate) {
    flags.push("Late");
  }
  if (day.isEarlyLeave) {
    flags.push("Early");
  }
  if (day.isMissedCheckout) {
    flags.push("No checkout");
  }
  return flags.length > 0 ? flags.join(", ") : "—";
}

export function ReportsEmployeeTable({ days, resetDeps, className }: ReportsEmployeeTableProps) {
  const columns = useMemo<ColumnDef<ReportDayRow>[]>(
    () => [
      {
        accessorKey: "shiftDate",
        header: "Shift date",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.shiftDate}</span>,
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
        accessorFn: (row) => formatPktIso(row.checkInAt),
        header: "Check-in",
        cell: ({ row }) => <span className="text-xs">{formatPktIso(row.original.checkInAt)}</span>,
      },
      {
        id: "checkOutAt",
        accessorFn: (row) => formatPktIso(row.checkOutAt),
        header: "Check-out",
        cell: ({ row }) => <span className="text-xs">{formatPktIso(row.original.checkOutAt)}</span>,
      },
      {
        id: "lateFine",
        accessorFn: (row) => row.lateFinePkr,
        header: "Late fine",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="text-xs tabular-nums">
            {row.original.lateFinePkr > 0 ? formatLateFinePkr(row.original.lateFinePkr) : "—"}
          </span>
        ),
      },
      {
        id: "flags",
        accessorFn: (row) => formatFlags(row),
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
        id: "break",
        accessorFn: (row) => formatBreakDuration(row.totalBreakSeconds),
        header: "Break",
        cell: ({ row }) => (
          <span className="text-xs">{formatBreakDuration(row.original.totalBreakSeconds)}</span>
        ),
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => <span className="text-xs capitalize">{row.original.source}</span>,
      },
      {
        accessorKey: "notes",
        header: "Notes",
        accessorFn: (row) => row.notes ?? "—",
        cell: ({ row }) => (
          <span className="block max-w-[200px] truncate text-xs text-muted-foreground">
            {row.original.notes ?? "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      className={className}
      columns={columns}
      data={days}
      emptyMessage="No attendance records in this range."
      resetDeps={resetDeps}
    />
  );
}
