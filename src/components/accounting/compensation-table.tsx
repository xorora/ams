"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import { formatMaskedTransferDetails } from "@/lib/accounting/bank-mask";
import { formatSalaryPkr } from "@/lib/accounting/format";
import type { SerializedCompensationListItem } from "@/lib/accounting/types";

type CompensationTableProps = {
  items: SerializedCompensationListItem[];
  loading?: boolean;
  resetDeps?: readonly unknown[];
  className?: string;
};

function AmountCell({ value }: { value: number | null }) {
  if (value == null) {
    return <Badge variant="outline">Not set</Badge>;
  }
  return <span className="tabular-nums">{formatSalaryPkr(value)}</span>;
}

export function CompensationTable({
  items,
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
        id: "department",
        accessorFn: (row) => row.department ?? "—",
        header: "Department",
        cell: ({ row }) => row.original.department ?? "—",
      },
      {
        id: "grossSalaryPkr",
        accessorFn: (row) => row.grossSalaryPkr ?? 0,
        header: "Gross Monthly Salary",
        meta: { align: "right" },
        cell: ({ row }) => <AmountCell value={row.original.grossSalaryPkr} />,
      },
      {
        id: "basicSalaryPkr",
        accessorFn: (row) => row.basicSalaryPkr ?? 0,
        header: "Basic Salary",
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.grossSalaryPkr != null ? (
            <span className="tabular-nums">{formatSalaryPkr(row.original.basicSalaryPkr ?? 0)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "conveyanceAllowancePkr",
        accessorFn: (row) => row.conveyanceAllowancePkr ?? 0,
        header: "Conveyance/Fuel/Food Allowance",
        meta: { align: "right" },
        cell: ({ row }) =>
          row.original.grossSalaryPkr != null ? (
            <span className="tabular-nums">
              {formatSalaryPkr(row.original.conveyanceAllowancePkr ?? 0)}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "bank",
        header: "Bank",
        cell: ({ row }) => {
          const masked = formatMaskedTransferDetails(
            row.original.bankName,
            row.original.bankAccountNumber,
          );
          return masked ?? "—";
        },
      },
      {
        id: "actions",
        header: "",
        meta: { align: "right" },
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            render={<Link href={`/admin/accounting/compensation/${row.original.employeeId}`} />}
          >
            {row.original.grossSalaryPkr != null ? "Edit" : "Set up"}
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
      data={items}
      loading={loading}
      emptyMessage="No employees found."
      resetDeps={resetDeps}
    />
  );
}
