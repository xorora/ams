"use client";

import { ReportStatCard } from "@/components/reports/report-stat-card";
import type { SummaryReport } from "@/lib/admin/reports-service";

type ReportsSummaryStatsProps = {
  totals: SummaryReport["totals"];
};

export function ReportsSummaryStats({ totals }: ReportsSummaryStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <ReportStatCard label="Records" value={totals.records} />
      <ReportStatCard label="Present" value={totals.present} />
      <ReportStatCard label="Absent" value={totals.absent} />
      <ReportStatCard label="Leave" value={totals.leave} />
      <ReportStatCard label="Late" value={totals.late} />
      <ReportStatCard label="Early leave" value={totals.earlyLeave} />
    </div>
  );
}
