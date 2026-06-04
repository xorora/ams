"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { ReportDateToolbar } from "@/components/reports/report-date-toolbar";
import { ReportsSummaryStats } from "@/components/reports/reports-summary-stats";
import { ReportsSummaryTable } from "@/components/reports/reports-summary-table";
import { reportDateQuery } from "@/lib/admin/query-params";
import type { SummaryReport } from "@/lib/admin/reports-service";

type ApiError = { error: string; code?: string };

type ReportsSummaryViewProps = {
  from: string;
  to: string;
  report: SummaryReport | null;
  loadError: string | null;
};

export function ReportsSummaryView({
  from: initialFrom,
  to: initialTo,
  report,
  loadError,
}: ReportsSummaryViewProps) {
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
      router.push(`/admin/reports${reportDateQuery(from, to)}`);
    });
  }

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
      <ReportDateToolbar
        from={from}
        to={to}
        onFromChange={setFrom}
        onToChange={setTo}
        onRefresh={handleRefresh}
        onExport={() => void handleExport()}
        loading={isPending}
        exporting={exporting}
        fromInputId="summary-from"
        toInputId="summary-to"
      />

      {feedback && <FeedbackBanner type={feedback.type} text={feedback.text} />}

      {isPending ? (
        <p className="text-muted-foreground text-sm">Loading report…</p>
      ) : report ? (
        <>
          <p className="text-muted-foreground text-sm">
            {report.range.from} to {report.range.to} · {report.activeEmployeeCount} active employees
          </p>

          <ReportsSummaryStats totals={report.totals} />
          <ReportsSummaryTable report={report} />
        </>
      ) : null}
    </div>
  );
}
