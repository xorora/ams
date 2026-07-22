"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { formatJoiningDate, formatSalaryPkr } from "@/lib/accounting/format";
import type { SerializedCompensationListItem } from "@/lib/accounting/types";

type CompensationTableProps = {
  items: SerializedCompensationListItem[];
  yearMonth: string;
  loading?: boolean;
  resetDeps?: readonly unknown[];
  className?: string;
};

function AmountCell({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="tabular-nums">{formatSalaryPkr(value)}</span>;
}

function NumberCell({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span className="tabular-nums">{value}</span>;
}

export function CompensationTable({
  items,
  yearMonth,
  loading = false,
  resetDeps,
  className,
}: CompensationTableProps) {
  const columns = useMemo<ColumnDef<SerializedCompensationListItem>[]>(
    () => [
      {
        accessorKey: "employeeCode",
        header: "Code",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.employeeCode}</span>,
      },
      {
        accessorKey: "fullName",
        header: "Name",
      },
      {
        id: "designation",
        accessorFn: (row) => row.designation ?? "—",
        header: "Designation",
        cell: ({ row }) => row.original.designation ?? "—",
      },
      {
        id: "joiningDate",
        accessorFn: (row) => row.joiningDate,
        header: "Joining Date",
        cell: ({ row }) => formatJoiningDate(row.original.joiningDate),
      },
      {
        id: "grossSalaryPkr",
        accessorFn: (row) => row.grossSalaryPkr ?? 0,
        header: "Gross Monthly Salary",
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.grossSalaryPkr != null ? (
            <span className="tabular-nums">{formatSalaryPkr(row.original.grossSalaryPkr)}</span>
          ) : (
            <Badge variant="outline">Not set</Badge>
          ),
      },
      {
        id: "basicSalaryPkr",
        accessorFn: (row) => row.basicSalaryPkr ?? 0,
        header: "Basic Salary",
        meta: { align: "right" },
        cell: ({ row }) => <AmountCell value={row.original.basicSalaryPkr} />,
      },
      {
        id: "adhocPkr",
        accessorFn: (row) => row.adhocPkr ?? 0,
        header: "ADHOC",
        meta: { align: "right" },
        cell: ({ row }) => <AmountCell value={row.original.adhocPkr} />,
      },
      {
        id: "allowances",
        header: "Allowances",
        columns: [
          {
            id: "hrAllowancePkr",
            accessorFn: (row: SerializedCompensationListItem) => row.hrAllowancePkr ?? 0,
            header: "HR",
            meta: { align: "right" },
            cell: ({ row }) => <AmountCell value={row.original.hrAllowancePkr} />,
          },
          {
            id: "medicalAllowancePkr",
            accessorFn: (row: SerializedCompensationListItem) => row.medicalAllowancePkr ?? 0,
            header: "Medical",
            meta: { align: "right" },
            cell: ({ row }) => <AmountCell value={row.original.medicalAllowancePkr} />,
          },
        ],
      },
      {
        id: "workingDays",
        accessorFn: (row) => row.workingDays ?? -1,
        header: "Working Days",
        meta: { align: "right" },
        cell: ({ row }) => <NumberCell value={row.original.workingDays} />,
      },
      {
        id: "daysWorked",
        accessorFn: (row) => row.daysWorked ?? -1,
        header: "Days Worked",
        meta: { align: "right" },
        cell: ({ row }) => <NumberCell value={row.original.daysWorked} />,
      },
      {
        id: "leaveDeductionPkr",
        accessorFn: (row) => row.leaveDeductionPkr ?? 0,
        header: "Leave Deduction",
        meta: { align: "right" },
        cell: ({ row }) => <AmountCell value={row.original.leaveDeductionPkr} />,
      },
      {
        id: "earnedSalaryPkr",
        accessorFn: (row) => row.earnedSalaryPkr ?? 0,
        header: "Earned Salary",
        meta: { align: "right" },
        cell: ({ row }) => <AmountCell value={row.original.earnedSalaryPkr} />,
      },
      {
        id: "incomeTaxPkr",
        accessorFn: (row) => row.incomeTaxPkr ?? 0,
        header: "Income Tax",
        meta: { align: "right" },
        cell: ({ row }) => <AmountCell value={row.original.incomeTaxPkr} />,
      },
      {
        id: "totalDeductionPkr",
        accessorFn: (row) => row.totalDeductionPkr ?? 0,
        header: "Total",
        meta: { align: "right" },
        cell: ({ row }) => <AmountCell value={row.original.totalDeductionPkr} />,
      },
      {
        id: "netSalaryPkr",
        accessorFn: (row) => row.netSalaryPkr ?? 0,
        header: "Net Salary",
        meta: { align: "right" },
        cell: ({ row }) => <AmountCell value={row.original.netSalaryPkr} />,
      },
      {
        id: "actions",
        header: "",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/admin/accounting/compensation/${row.original.employeeId}?yearMonth=${encodeURIComponent(yearMonth)}`}
              />
            }
          >
            {row.original.grossSalaryPkr != null ? "Edit" : "Set up"}
          </Button>
        ),
      },
    ],
    [yearMonth],
  );

  return (
    <DataTable
      className={className}
      columns={columns}
      data={items}
      loading={loading}
      emptyMessage="No employees found."
      resetDeps={resetDeps}
    />
  );
}
