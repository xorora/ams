"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ColumnDef, DataTable } from "@/components/ui/table";
import type { SummaryReport } from "@/lib/admin/reports-service";
import { formatLateFinePkr } from "@/lib/attendance/late-fines-utils";

type ReportsSummaryTableProps = {
  report: SummaryReport;
  className?: string;
};

type SummaryEmployeeRow = SummaryReport["employees"][number];

export function ReportsSummaryTable({ report, className }: ReportsSummaryTableProps) {
  const router = useRouter();

  const columns = useMemo<ColumnDef<SummaryEmployeeRow>[]>(
    () => [
      {
        id: "employee",
        accessorFn: (row) => row.fullName,
        header: "Employee",
        cell: ({ row }) => row.original.fullName,
      },
      {
        id: "designation",
        accessorFn: (row) => row.designation ?? "—",
        header: "Designation",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.designation ?? "—"}</span>
        ),
      },
      {
        id: "department",
        accessorFn: (row) => row.department ?? "—",
        header: "Department",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.department ?? "—"}</span>
        ),
      },
      {
        id: "records",
        accessorFn: (row) => row.totals.records,
        header: "Records",
        meta: { align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.totals.records}</span>,
      },
      {
        id: "present",
        accessorFn: (row) => row.totals.present,
        header: "Present",
        meta: { align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.totals.present}</span>,
      },
      {
        id: "absent",
        accessorFn: (row) => row.totals.absent,
        header: "Absent",
        meta: { align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.totals.absent}</span>,
      },
      {
        id: "leave",
        accessorFn: (row) => row.totals.leave,
        header: "Leave",
        meta: { align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.totals.leave}</span>,
      },
      {
        id: "late",
        accessorFn: (row) => row.totals.late,
        header: "Late",
        meta: { align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.totals.late}</span>,
      },
      {
        id: "lateFine",
        accessorFn: (row) => row.totals.lateFinePkr,
        header: "Late fines",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.totals.lateFinePkr > 0
              ? formatLateFinePkr(row.original.totals.lateFinePkr)
              : "—"}
          </span>
        ),
      },
      {
        id: "earlyLeave",
        accessorFn: (row) => row.totals.earlyLeave,
        header: "Early",
        meta: { align: "right" },
        cell: ({ row }) => <span className="tabular-nums">{row.original.totals.earlyLeave}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label="Open actions menu" />}
            >
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  router.push(
                    `/admin/reports/${row.original.employeeId}?from=${report.range.from}&to=${report.range.to}`,
                  )
                }
              >
                View report
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [report.range.from, report.range.to, router],
  );

  return (
    <DataTable
      className={className}
      columns={columns}
      data={report.employees}
      emptyMessage="No active employees found."
      resetDeps={[report.range.from, report.range.to]}
    />
  );
}
