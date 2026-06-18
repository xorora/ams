"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { formatPktIso, formatShiftDuration } from "@/lib/admin/display";
import type { SerializedEligibleOvertimeDay } from "@/lib/overtime/serialize";

type EligibleOvertimeTableProps = {
  days: SerializedEligibleOvertimeDay[];
  onApply: (day: SerializedEligibleOvertimeDay) => void;
  className?: string;
};

export function EligibleOvertimeTable({ days, onApply, className }: EligibleOvertimeTableProps) {
  const columns = useMemo<ColumnDef<SerializedEligibleOvertimeDay>[]>(
    () => [
      {
        accessorKey: "shiftDate",
        header: "Shift date",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.shiftDate}</span>,
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
        id: "overtime",
        header: "Overtime",
        cell: ({ row }) => (
          <span className="text-xs">{formatShiftDuration(row.original.overtimeSeconds)}</span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <Button type="button" size="sm" variant="outline" onClick={() => onApply(row.original)}>
            Apply
          </Button>
        ),
      },
    ],
    [onApply],
  );

  return (
    <DataTable
      className={className}
      columns={columns}
      data={days}
      emptyMessage="No eligible overtime days. Overtime of at least 2 hours is required after check-out."
    />
  );
}
