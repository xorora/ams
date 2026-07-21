"use client";

import { leaveTypeLabel } from "@/lib/leave/display";
import type { UnpaidLeaveSummary } from "@/lib/leave/types";

type UnpaidLeaveSummaryCardProps = {
  summary: UnpaidLeaveSummary;
};

export function UnpaidLeaveSummaryCard({ summary }: UnpaidLeaveSummaryCardProps) {
  return (
    <div className="max-w-sm rounded-xl border border-white/12 bg-[#050d22]/80 p-4">
      <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#c8cce0] uppercase">
        {leaveTypeLabel("unpaid")}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-white">{summary.total}</p>
      <p className="mt-1 text-sm font-medium text-[#d7dceb]">
        {summary.total === 1 ? "working day" : "working days"} during probation
      </p>
      <p className="mt-2 text-xs font-medium text-[#c8cce0]">
        {summary.used} approved
        {summary.pending > 0 ? ` · ${summary.pending} pending approval` : ""}
      </p>
    </div>
  );
}
