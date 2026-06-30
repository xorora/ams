"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ReportDateToolbar } from "@/components/reports/report-date-toolbar";
import { ReportsSummaryTable } from "@/components/reports/reports-summary-table";
import { reportDateQuery } from "@/lib/admin/query-params";
import { validateReportDateRangeInput } from "@/lib/admin/reports-date-range";
import type { SummaryReport } from "@/lib/admin/reports-service";
import { downloadResponseBlob, toastAsync, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ReportsSummaryViewProps = {
  from: string;
  to: string;
  report: SummaryReport | null;
  loadError: string | null;
  className?: string;
};

export function ReportsSummaryView({
  from: initialFrom,
  to: initialTo,
  report,
  loadError,
  className,
}: ReportsSummaryViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setFrom(initialFrom);
    setTo(initialTo);
  }, [initialFrom, initialTo]);

  useEffect(() => {
    if (loadError) {
      toastError(loadError);
    }
  }, [loadError]);

  function handleRefresh() {
    const validation = validateReportDateRangeInput(from, to);
    if (!validation.ok) {
      toastError(validation.message);
      return;
    }

    setFrom(validation.from);
    setTo(validation.to);
    startTransition(() => {
      router.push(`/admin/reports${reportDateQuery(validation.from, validation.to)}`);
    });
  }

  async function handleExport() {
    const validation = validateReportDateRangeInput(from, to);
    if (!validation.ok) {
      toastError(validation.message);
      return;
    }

    setExporting(true);

    try {
      const params = new URLSearchParams({
        scope: "summary",
        from: validation.from,
        to: validation.to,
      });
      await toastAsync(
        fetch(`/api/admin/reports/export?${params.toString()}`).then((response) =>
          downloadResponseBlob(
            response,
            `attendance-summary_${validation.from}_${validation.to}.xlsx`,
          ),
        ),
        {
          loading: "Exporting Excel file…",
          success: "Excel file downloaded.",
        },
      );
    } catch {
      // toastAsync already surfaced the error toast
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className={cn("flex flex-col gap-4 md:min-h-0 md:flex-1 md:overflow-hidden", className)}>
      <div className="shrink-0">
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
      </div>

      {isPending ? (
        <p className="shrink-0 text-muted-foreground text-sm">Loading report…</p>
      ) : report ? (
        <ReportsSummaryTable report={report} className="md:min-h-0 md:flex-1" />
      ) : null}
    </div>
  );
}
