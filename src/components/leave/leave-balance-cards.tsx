"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LEAVE_ENTITLEMENTS } from "@/lib/leave/constants";
import { leaveTypeLabel } from "@/lib/leave/display";
import type { LeaveBalance } from "@/lib/leave/types";

type LeaveBalanceCardsProps = {
  balances: LeaveBalance[];
};

export function LeaveBalanceCards({ balances }: LeaveBalanceCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {balances.map((balance) => {
        const config = LEAVE_ENTITLEMENTS[balance.leaveType];
        const unitLabel = config.workingDaysOnly ? "working days" : "days";

        return (
          <Card key={balance.leaveType} size="sm">
            <CardHeader>
              <CardTitle className="text-muted-foreground text-xs uppercase tracking-wide">
                {leaveTypeLabel(balance.leaveType)}
              </CardTitle>
            </CardHeader>
            <CardContent className="-mt-2 space-y-1">
              <p className="text-2xl font-semibold tabular-nums">{balance.remaining}</p>
              <p className="text-muted-foreground text-xs">
                {balance.remaining} of {balance.entitled} {unitLabel} remaining
              </p>
              {balance.pending > 0 ? (
                <p className="text-muted-foreground text-xs">{balance.pending} pending approval</p>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
