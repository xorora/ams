"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { leaveTypeLabel } from "@/lib/leave/display";
import type { UnpaidLeaveSummary } from "@/lib/leave/types";

type UnpaidLeaveSummaryCardProps = {
  summary: UnpaidLeaveSummary;
};

export function UnpaidLeaveSummaryCard({ summary }: UnpaidLeaveSummaryCardProps) {
  return (
    <Card size="sm" className="max-w-sm">
      <CardHeader>
        <CardTitle className="text-muted-foreground text-xs uppercase tracking-wide">
          {leaveTypeLabel("unpaid")}
        </CardTitle>
      </CardHeader>
      <CardContent className="-mt-2 space-y-1">
        <p className="text-2xl font-semibold tabular-nums">{summary.total}</p>
        <p className="text-muted-foreground text-xs">
          {summary.total === 1 ? "working day" : "working days"} during probation
        </p>
        <p className="text-muted-foreground text-xs">
          {summary.used} approved
          {summary.pending > 0 ? ` · ${summary.pending} pending approval` : ""}
        </p>
      </CardContent>
    </Card>
  );
}
