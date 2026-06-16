"use client";

import { ReportStatCard } from "@/components/reports/report-stat-card";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";
import { formatLateFinePkr } from "@/lib/attendance/late-fines-utils";

type ReportsEmployeeStatsProps = {
  summary: SerializedEmployeeReport["summary"];
};

export function ReportsEmployeeStats({ summary }: ReportsEmployeeStatsProps) {
  return (
    <div className="grid gap-x-8 gap-y-4 border-t pt-4 sm:grid-cols-2 lg:grid-cols-4">
      <ReportStatCard label="Records" value={summary.records} />
      <ReportStatCard label="Present" value={summary.present} />
      <ReportStatCard label="Absent" value={summary.absent} />
      <ReportStatCard label="Leave" value={summary.leave} />
      <ReportStatCard label="Late" value={summary.late} />
      <ReportStatCard label="Fined lates" value={summary.fineableLates} />
      <ReportStatCard label="Late fines" value={formatLateFinePkr(summary.lateFinePkr)} />
      <ReportStatCard label="Early leave" value={summary.earlyLeave} />
    </div>
  );
}
