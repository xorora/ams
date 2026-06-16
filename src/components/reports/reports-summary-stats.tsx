"use client";

import { ReportStatCard } from "@/components/reports/report-stat-card";
import type { SummaryReport } from "@/lib/admin/reports-service";
import { formatLateFinePkr } from "@/lib/attendance/late-fines-utils";

type ReportsSummaryStatsProps = {
  totals: SummaryReport["totals"];
};

export function ReportsSummaryStats({ totals }: ReportsSummaryStatsProps) {
  return (
    <div className="grid gap-x-8 gap-y-4 border-b pb-4 sm:grid-cols-2 lg:grid-cols-4">
      <ReportStatCard label="Records" value={totals.records} />
      <ReportStatCard label="Present" value={totals.present} />
      <ReportStatCard label="Absent" value={totals.absent} />
      <ReportStatCard label="Leave" value={totals.leave} />
      <ReportStatCard label="Late" value={totals.late} />
      <ReportStatCard label="Fined lates" value={totals.fineableLates} />
      <ReportStatCard label="Late fines" value={formatLateFinePkr(totals.lateFinePkr)} />
      <ReportStatCard label="Early leave" value={totals.earlyLeave} />
    </div>
  );
}
