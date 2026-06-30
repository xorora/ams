"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ReportDateToolbar } from "@/components/reports/report-date-toolbar";
import { ReportsEmployeeHeader } from "@/components/reports/reports-employee-header";
import { ReportsEmployeeStats } from "@/components/reports/reports-employee-stats";
import { ReportsEmployeeTable } from "@/components/reports/reports-employee-table";
import { reportDateQuery } from "@/lib/admin/query-params";
import { validateReportDateRangeInput } from "@/lib/admin/reports-date-range";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";
import { downloadResponseBlob, toastAsync, toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

type ReportsEmployeeViewProps = {
  employeeId: string;
  from: string;
  to: string;
  report: SerializedEmployeeReport | null;
  loadError: string | null;
  className?: string;
};

export function ReportsEmployeeView({
  employeeId,
  from: initialFrom,
  to: initialTo,
  report,
  loadError,
  className,
}: ReportsEmployeeViewProps) {
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
      router.push(`/admin/reports/${employeeId}${reportDateQuery(validation.from, validation.to)}`);
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
        scope: "employee",
        employeeId,
        from: validation.from,
        to: validation.to,
      });
      await toastAsync(
        fetch(`/api/admin/reports/export?${params.toString()}`).then((response) =>
          downloadResponseBlob(
            response,
            `attendance-employee_${validation.from}_${validation.to}.xlsx`,
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
          fromInputId="employee-from"
          toInputId="employee-to"
        />
      </div>

      {isPending ? (
        <p className="shrink-0 text-muted-foreground text-sm">Loading report…</p>
      ) : report ? (
        <>
          <div className="shrink-0 space-y-4 border-b pb-4">
            <ReportsEmployeeHeader report={report} />
            <ReportsEmployeeStats summary={report.summary} />
          </div>
          <ReportsEmployeeTable
            days={report.days}
            className="md:min-h-0 md:flex-1"
            resetDeps={[from, to, employeeId]}
          />
        </>
      ) : null}

      <Link
        href={`/admin/reports${reportDateQuery(from, to)}`}
        className="shrink-0 text-primary text-sm underline-offset-4 hover:underline"
      >
        ← Back to summary report
      </Link>
    </div>
  );
}
