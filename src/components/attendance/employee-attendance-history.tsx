"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ReportDateToolbar } from "@/components/reports/report-date-toolbar";
import { ReportsEmployeeStats } from "@/components/reports/reports-employee-stats";
import { ReportsEmployeeTable } from "@/components/reports/reports-employee-table";
import { reportDateQuery } from "@/lib/admin/query-params";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";
import { toastError } from "@/lib/toast";
import { cn } from "@/lib/utils";

type EmployeeAttendanceHistoryProps = {
  from: string;
  to: string;
  report: SerializedEmployeeReport | null;
  loadError: string | null;
  className?: string;
};

export function EmployeeAttendanceHistory({
  from: initialFrom,
  to: initialTo,
  report,
  loadError,
  className,
}: EmployeeAttendanceHistoryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

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
    startTransition(() => {
      router.push(`/attendance/history${reportDateQuery(from, to)}`);
    });
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
          onExport={() => {}}
          loading={isPending}
          exporting={false}
          fromInputId="history-from"
          toInputId="history-to"
          showExport={false}
        />
      </div>

      {isPending ? (
        <p className="shrink-0 text-muted-foreground text-sm">Loading attendance history…</p>
      ) : report ? (
        <>
          <div className="shrink-0 space-y-4 border-b pb-4">
            <p className="text-muted-foreground text-sm">
              {report.range.from} to {report.range.to} · {report.summary.shiftDaysInRange} shift
              days in range
            </p>
            <ReportsEmployeeStats summary={report.summary} />
          </div>
          <ReportsEmployeeTable
            days={report.days}
            className="md:min-h-0 md:flex-1"
            resetDeps={[from, to]}
          />
        </>
      ) : null}
    </div>
  );
}
