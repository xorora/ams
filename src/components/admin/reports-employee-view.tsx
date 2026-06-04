"use client";

import { formatInTimeZone } from "date-fns-tz";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { defaultReportDateRange } from "@/lib/admin/reports-date-range";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";

type ApiError = { error: string; code?: string };

type ReportsEmployeeViewProps = {
  employeeId: string;
};

function formatPkt(iso: string | null): string {
  if (!iso) {
    return "—";
  }
  return formatInTimeZone(new Date(iso), BUSINESS_TIMEZONE, "yyyy-MM-dd HH:mm");
}

function formatBreak(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s`;
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "present":
      return "default";
    case "absent":
      return "destructive";
    case "leave":
      return "outline";
    default:
      return "secondary";
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs uppercase tracking-wide">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="-mt-2">
        <p className="text-2xl font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

export function ReportsEmployeeView({ employeeId }: ReportsEmployeeViewProps) {
  const searchParams = useSearchParams();
  const defaults = defaultReportDateRange();
  const [from, setFrom] = useState(searchParams.get("from") ?? defaults.from);
  const [to, setTo] = useState(searchParams.get("to") ?? defaults.to);
  const [report, setReport] = useState<SerializedEmployeeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const loadReport = useCallback(async () => {
    if (!from || !to) {
      return;
    }
    setLoading(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams({ employeeId, from, to });
      const res = await fetch(`/api/admin/reports/employee?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Failed to load report");
      }
      const data = (await res.json()) as { report: SerializedEmployeeReport };
      setReport(data.report);
    } catch (error) {
      setReport(null);
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load report",
      });
    } finally {
      setLoading(false);
    }
  }, [employeeId, from, to]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  async function handleExport() {
    setExporting(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams({
        scope: "employee",
        employeeId,
        from,
        to,
      });
      const res = await fetch(`/api/admin/reports/export?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const fallback = `attendance-employee_${from}_${to}.xlsx`;
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? fallback;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setFeedback({ type: "success", text: "Excel file downloaded." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Export failed",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee-from">From shift date</Label>
          <Input
            id="employee-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="employee-to">To shift date</Label>
          <Input id="employee-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => void loadReport()}
          disabled={loading}
        >
          Refresh
        </Button>
        <Button type="button" onClick={() => void handleExport()} disabled={exporting || loading}>
          {exporting ? "Exporting…" : "Download Excel"}
        </Button>
      </div>

      {feedback && <FeedbackBanner type={feedback.type} text={feedback.text} />}

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading report…</p>
      ) : report ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{report.employee.fullName}</CardTitle>
            </CardHeader>
            <CardContent className="-mt-2">
              <p className="text-muted-foreground text-sm">
                {report.employee.employeeCode} · {report.employee.email}
                {report.employee.department ? ` · ${report.employee.department}` : ""}
                {!report.employee.isActive && (
                  <span className="ml-2 text-amber-700 dark:text-amber-300">(inactive)</span>
                )}
              </p>
              <p className="mt-2 text-muted-foreground text-sm">
                {report.range.from} to {report.range.to} · {report.summary.shiftDaysInRange} shift
                days in range
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Records" value={report.summary.records} />
            <StatCard label="Present" value={report.summary.present} />
            <StatCard label="Absent" value={report.summary.absent} />
            <StatCard label="Leave" value={report.summary.leave} />
            <StatCard label="Late" value={report.summary.late} />
            <StatCard label="Early leave" value={report.summary.earlyLeave} />
          </div>

          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shift date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead>Check-out</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Break</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.days.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      No attendance records in this range.
                    </TableCell>
                  </TableRow>
                ) : (
                  report.days.map((day) => (
                    <TableRow key={day.shiftDate}>
                      <TableCell className="font-mono text-xs">{day.shiftDate}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(day.status)} className="capitalize">
                          {day.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{formatPkt(day.checkInAt)}</TableCell>
                      <TableCell className="text-xs">{formatPkt(day.checkOutAt)}</TableCell>
                      <TableCell className="text-xs">
                        {day.isLate && (
                          <span className="mr-1 text-amber-700 dark:text-amber-300">Late</span>
                        )}
                        {day.isEarlyLeave && (
                          <span className="text-amber-700 dark:text-amber-300">Early</span>
                        )}
                        {!day.isLate && !day.isEarlyLeave && "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {formatBreak(day.totalBreakSeconds)}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{day.source}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                        {day.notes ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : null}

      <Link
        href={`/admin/reports?from=${from}&to=${to}`}
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        ← Back to summary report
      </Link>
    </div>
  );
}
