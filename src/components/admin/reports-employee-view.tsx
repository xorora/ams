"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { ReportDateToolbar } from "@/components/reports/report-date-toolbar";
import { ReportsEmployeeHeader } from "@/components/reports/reports-employee-header";
import { ReportsEmployeeStats } from "@/components/reports/reports-employee-stats";
import { ReportsEmployeeTable } from "@/components/reports/reports-employee-table";
import { reportDateQuery } from "@/lib/admin/query-params";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";

type ApiError = { error: string; code?: string };

type ReportsEmployeeViewProps = {
  employeeId: string;
  from: string;
  to: string;
  report: SerializedEmployeeReport | null;
  loadError: string | null;
};

export function ReportsEmployeeView({
  employeeId,
  from: initialFrom,
  to: initialTo,
  report,
  loadError,
}: ReportsEmployeeViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    loadError ? { type: "error", text: loadError } : null,
  );

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
  }, [initialFrom, initialTo]);

  useEffect(() => {
    if (loadError) {
      setFeedback({ type: "error", text: loadError });
    }
  }, [loadError]);

  function handleRefresh() {
    startTransition(() => {
      router.push(`/admin/reports/${employeeId}${reportDateQuery(from, to)}`);
    });
  }

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
      <ReportDateToolbar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onRefresh={handleRefresh}
        onExport={() => void handleExport()}
        loading={isPending}
        exporting={exporting}
        fromInputId="employee-from"
        toInputId="employee-to"
      />

      {feedback && <FeedbackBanner type={feedback.type} text={feedback.text} />}

      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading report…</p>
      ) : report ? (
        <>
          <ReportsEmployeeHeader report={report} />
          <ReportsEmployeeStats summary={report.summary} />
          <ReportsEmployeeTable days={report.days} />
        </>
      ) : null}

      <Link
        href={`/admin/reports${reportDateQuery(from, to)}`}
        className="text-primary text-sm underline-offset-4 hover:underline"
      >
        ← Back to summary report
      </Link>
    </div>
  );
}
