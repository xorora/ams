"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { formatSalaryPkr, formatYearMonth } from "@/lib/accounting/format";
import type { SerializedSalarySlipListItem } from "@/lib/accounting/types";

type SalarySlipsTableProps = {
  slips: SerializedSalarySlipListItem[];
  loading?: boolean;
  resetDeps?: readonly unknown[];
  className?: string;
};

export function SalarySlipsTable({
  slips,
  loading = false,
  resetDeps,
  className,
}: SalarySlipsTableProps) {
  const columns = useMemo<ColumnDef<SerializedSalarySlipListItem>[]>(
    () => [
      {
        accessorKey: "employeeCode",
        header: "Code",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.employeeCode}</span>,
      },
      {
        accessorKey: "employeeName",
        header: "Employee",
      },
      {
        id: "yearMonth",
        accessorFn: (row) => formatYearMonth(row.yearMonth),
        header: "Month",
        cell: ({ row }) => formatYearMonth(row.original.yearMonth),
      },
      {
        id: "calculatedSalaryPkr",
        accessorFn: (row) => row.calculatedSalaryPkr,
        header: "Cal salary",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums">{formatSalaryPkr(row.original.calculatedSalaryPkr)}</span>
        ),
      },
      {
        id: "netSalaryPkr",
        accessorFn: (row) => row.netSalaryPkr,
        header: "Net salary",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-medium tabular-nums">
            {formatSalaryPkr(row.original.netSalaryPkr)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/admin/accounting/salary-slips/${row.original.id}`} />}
          >
            View
          </Button>
        ),
      },
    ],
    [],
  );

  return (
    <DataTable
      className={className}
      columns={columns}
      data={slips}
      loading={loading}
      emptyMessage="No salary slips for this month."
      resetDeps={resetDeps}
    />
  );
}
