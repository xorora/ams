"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { formatSalaryPkr, formatYearMonth } from "@/lib/accounting/format";
import type { SerializedSalarySlipListItem } from "@/lib/accounting/types";

type EmployeeSalarySlipsTableProps = {
  slips: SerializedSalarySlipListItem[];
  className?: string;
};

export function EmployeeSalarySlipsTable({ slips, className }: EmployeeSalarySlipsTableProps) {
  const columns = useMemo<ColumnDef<SerializedSalarySlipListItem>[]>(
    () => [
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
          <Button variant="outline" size="sm" render={<Link href={`/salary/${row.original.id}`} />}>
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
      emptyMessage="No salary slips have been published yet."
    />
  );
}
