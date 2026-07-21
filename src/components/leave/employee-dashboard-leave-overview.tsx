import Link from "next/link";
import { LeaveBalanceCards } from "@/components/leave/leave-balance-cards";
import { UnpaidLeaveSummaryCard } from "@/components/leave/unpaid-leave-summary-card";
import type { LeaveBalance, UnpaidLeaveSummary } from "@/lib/leave/types";

type EmployeeDashboardLeaveOverviewProps = {
  probationUnpaidOnly: boolean;
  balances: LeaveBalance[];
  unpaidSummary: UnpaidLeaveSummary;
};

export function EmployeeDashboardLeaveOverview({
  probationUnpaidOnly,
  balances,
  unpaidSummary,
}: EmployeeDashboardLeaveOverviewProps) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-white/15 bg-[#0a1230] p-4 sm:p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_100%_0%,#464c9f28,transparent_55%)]"
      />
      <div className="relative space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#f26b21] uppercase">
              Leave
            </p>
            <h2 className="text-base font-semibold text-white">
              {probationUnpaidOnly ? "Emergency leave" : "Leave balance"}
            </h2>
          </div>
          <Link
            href="/leave"
            className="shrink-0 rounded-lg border border-[#f26b21]/40 bg-[#f26b21]/10 px-2.5 py-1 text-xs font-semibold text-[#ffb27a] hover:bg-[#f26b21]/20 hover:text-white"
          >
            View leave
          </Link>
        </div>

        {probationUnpaidOnly ? (
          <UnpaidLeaveSummaryCard summary={unpaidSummary} />
        ) : (
          <LeaveBalanceCards balances={balances} />
        )}
      </div>
    </section>
  );
}
