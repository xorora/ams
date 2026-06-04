"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
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
import type { SummaryReport } from "@/lib/admin/reports-service";

type ApiError = { error: string; code?: string };

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

export function ReportsSummaryView() {
  const searchParams = useSearchParams();
  const defaults = defaultReportDateRange();
  const [from, setFrom] = useState(searchParams.get("from") ?? defaults.from);
  const [to, setTo] = useState(searchParams.get("to") ?? defaults.to);
  const [report, setReport] = useState<SummaryReport | null>(null);
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
      const params = new URLSearchParams({ from, to });
      const res = await fetch(`/api/admin/reports/summary?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Failed to load report");
      }
      const data = (await res.json()) as { report: SummaryReport };
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
  }, [from, to]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  async function handleExport() {
    setExporting(true);
    setFeedback(null);
    try {
      const params = new URLSearchParams({ scope: "summary", from, to });
      const res = await fetch(`/api/admin/reports/export?${params.toString()}`);
      if (!res.ok) {
        const err = (await res.json()) as ApiError;
        throw new Error(err.error ?? "Export failed");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const fallback = `attendance-summary_${from}_${to}.xlsx`;
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
          <Label htmlFor="summary-from">From shift date</Label>
          <Input
            id="summary-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="summary-to">To shift date</Label>
          <Input id="summary-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
          <p className="text-muted-foreground text-sm">
            {report.range.from} to {report.range.to} · {report.activeEmployeeCount} active employees
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Records" value={report.totals.records} />
            <StatCard label="Present" value={report.totals.present} />
            <StatCard label="Absent" value={report.totals.absent} />
            <StatCard label="Leave" value={report.totals.leave} />
            <StatCard label="Late" value={report.totals.late} />
            <StatCard label="Early leave" value={report.totals.earlyLeave} />
          </div>

          <Card className="py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
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
                    <TableCell colSpan={9} className="text-muted-foreground">
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
                      <TableCell className="text-muted-foreground">
                        {row.department ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.totals.records}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.totals.present}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{row.totals.absent}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.totals.leave}</TableCell>
                      <TableCell className="text-right tabular-nums">{row.totals.late}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.totals.earlyLeave}
                      </TableCell>
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
        </>
      ) : null}
    </div>
  );
}
