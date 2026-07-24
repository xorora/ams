"use client";

import { LEAVE_ENTITLEMENTS } from "@/lib/leave/constants";
import { formatLeaveDays, leaveTypeLabel } from "@/lib/leave/display";
import type { LeaveBalance } from "@/lib/leave/types";

type LeaveBalanceCardsProps = {
  balances: LeaveBalance[];
};

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {balances.map((balance) => {
        const config = LEAVE_ENTITLEMENTS[balance.leaveType];
        const unitLabel = config.workingDaysOnly ? "working days" : "days";
        const usedPct =
          balance.entitled > 0
            ? Math.min(100, Math.round((balance.used / balance.entitled) * 100))
            : 0;

        return (
          <div
            key={balance.leaveType}
            className="rounded-xl border border-white/12 bg-[#050d22]/80 p-4"
          >
            <p className="font-mono text-[10px] font-semibold tracking-[0.16em] text-[#c8cce0] uppercase">
              {leaveTypeLabel(balance.leaveType)}
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums text-white">
              {formatLeaveDays(balance.remaining)}
            </p>
            <p className="mt-1 text-sm font-medium text-[#d7dceb]">
              of {formatLeaveDays(balance.entitled)} {unitLabel} left
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#6b70b6]"
                style={{ width: `${usedPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs font-medium text-[#c8cce0]">
              Used {formatLeaveDays(balance.used)}
              {balance.pending > 0 ? ` · ${formatLeaveDays(balance.pending)} pending` : ""}
            </p>
          </div>
        );
      })}
    </div>
  );
}
