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
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium">
            {probationUnpaidOnly ? "Emergency leave" : "Leave balance"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {probationUnpaidOnly
              ? "Emergency unpaid leave taken during probation."
              : "Your remaining leave for the current year."}
          </p>
        </div>
        <Link href="/leave" className="text-primary shrink-0 text-sm font-medium hover:underline">
          View leave
        </Link>
      </div>

      {probationUnpaidOnly ? (
        <UnpaidLeaveSummaryCard summary={unpaidSummary} />
      ) : (
        <LeaveBalanceCards balances={balances} />
      )}
    </section>
  );
}
