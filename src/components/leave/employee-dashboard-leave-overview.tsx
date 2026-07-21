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
    <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0a1230] p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)] sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_100%_0%,#464c9f30,transparent_55%)]"
      />
      <div className="relative space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-[#f26b21] uppercase">
              Leave
            </p>
            <h2 className="mt-1 text-lg font-semibold text-white">
              {probationUnpaidOnly ? "Emergency leave" : "Leave balance"}
            </h2>
            <p className="mt-1 text-sm text-[#d7dceb]">
              {probationUnpaidOnly
                ? "Emergency unpaid leave taken during probation."
                : "Your remaining leave for the current year."}
            </p>
          </div>
          <Link
            href="/leave"
            className="shrink-0 rounded-lg border border-[#f26b21]/40 bg-[#f26b21]/10 px-3 py-1.5 text-sm font-semibold text-[#ffb27a] hover:bg-[#f26b21]/20 hover:text-white"
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
