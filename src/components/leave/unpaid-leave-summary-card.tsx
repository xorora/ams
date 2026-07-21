"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { leaveTypeLabel } from "@/lib/leave/display";
import type { UnpaidLeaveSummary } from "@/lib/leave/types";

type UnpaidLeaveSummaryCardProps = {
  summary: UnpaidLeaveSummary;
};

export function UnpaidLeaveSummaryCard({ summary }: UnpaidLeaveSummaryCardProps) {
  return (
    <Card size="sm" className="max-w-sm border-white/10 bg-[#0a1230]/90 ring-white/10">
      <CardHeader>
        <CardTitle className="font-mono text-[11px] text-[#a8aec4] uppercase tracking-[0.14em]">
          {leaveTypeLabel("unpaid")}
        </CardTitle>
      </CardHeader>
      <CardContent className="-mt-2 space-y-1">
        <p className="text-2xl font-semibold tabular-nums text-white">{summary.total}</p>
        <p className="text-[#a8aec4] text-xs">
          {summary.total === 1 ? "working day" : "working days"} during probation
        </p>
        <p className="text-[#7d859e] text-xs">
          {summary.used} approved
          {summary.pending > 0 ? ` · ${summary.pending} pending approval` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
