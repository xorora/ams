"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SummaryReport } from "@/lib/admin/reports-service";

type ReportsSummaryTableProps = {
  report: SummaryReport;
};

export function ReportsSummaryTable({ report }: ReportsSummaryTableProps) {
  return (
    <Card className="py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Employee</TableHead>
            <TableHead>Designation</TableHead>
            <TableHead>Department</TableHead>
            <TableHead className="text-right">Records</TableHead>
            <TableHead className="text-right">Present</TableHead>
            <TableHead className="text-right">Absent</TableHead>
            <TableHead className="text-right">Leave</TableHead>
            <TableHead className="text-right">Late</TableHead>
            <TableHead className="text-right">Early</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {report.employees.length === 0 ? (
            <TableRow>
              <TableCell colSpan={10} className="text-muted-foreground">
                No active employees found.
              </TableCell>
            </TableRow>
          ) : (
            report.employees.map((row) => (
              <TableRow key={row.employeeId}>
                <TableCell>
                  <div>{row.fullName}</div>
                  <div className="text-muted-foreground text-xs">{row.employeeCode}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">{row.designation ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{row.department ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{row.totals.records}</TableCell>
                <TableCell className="text-right tabular-nums">{row.totals.present}</TableCell>
                <TableCell className="text-right tabular-nums">{row.totals.absent}</TableCell>
                <TableCell className="text-right tabular-nums">{row.totals.leave}</TableCell>
                <TableCell className="text-right tabular-nums">{row.totals.late}</TableCell>
                <TableCell className="text-right tabular-nums">{row.totals.earlyLeave}</TableCell>
                <TableCell>
                  <Link
                    href={`/admin/reports/${row.employeeId}?from=${report.range.from}&to=${report.range.to}`}
                    className="text-primary text-sm underline-offset-4 hover:underline"
                  >
                    View
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
