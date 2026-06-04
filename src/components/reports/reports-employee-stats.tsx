"use client";

import { ReportStatCard } from "@/components/reports/report-stat-card";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";

type ReportsEmployeeStatsProps = {
  summary: SerializedEmployeeReport["summary"];
};

export function ReportsEmployeeStats({ summary }: ReportsEmployeeStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <ReportStatCard label="Records" value={summary.records} />
      <ReportStatCard label="Present" value={summary.present} />
      <ReportStatCard label="Absent" value={summary.absent} />
      <ReportStatCard label="Leave" value={summary.leave} />
      <ReportStatCard label="Late" value={summary.late} />
      <ReportStatCard label="Early leave" value={summary.earlyLeave} />
    </div>
  );
}
