"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatPktTime, formatShiftDuration } from "@/lib/admin/display";
import {
  formatLateFinePkr,
  LATE_FINE_AMOUNT_PKR,
  MONTHLY_LATE_ALLOWANCE,
} from "@/lib/attendance/late-fines-utils";
import { getLiveBreakSeconds, getLiveElapsedShiftSeconds } from "@/lib/attendance/live-shift-time";
import { MAX_BREAK_SECONDS } from "@/lib/attendance/constants";
import type { SerializedTodayStatus } from "@/lib/attendance/serialize";
import type { WorkState } from "@/lib/attendance/status";

const STATE_LABELS: Record<WorkState, string> = {
  not_checked_in: "Not checked in",
  checked_in: "Checked in",
  on_break: "On break",
  checked_out: "Checked out",
};

type EmployeeStatusCardProps = {
  status: SerializedTodayStatus;
};

export function EmployeeStatusCard({ status }: EmployeeStatusCardProps) {
  const [elapsedShiftSeconds, setElapsedShiftSeconds] = useState<number | null>(() =>
    getLiveElapsedShiftSeconds(status, new Date()),
  );
  const [liveBreakSeconds, setLiveBreakSeconds] = useState(() =>
    getLiveBreakSeconds(status, new Date()),
  );

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setElapsedShiftSeconds(getLiveElapsedShiftSeconds(status, now));
      setLiveBreakSeconds(getLiveBreakSeconds(status, now));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const stateBadgeVariant =
    status.state === "not_checked_in" && status.isWeekendOff
      ? "outline"
      : status.state === "on_break"
        ? "outline"
        : status.state === "checked_in"
          ? "default"
          : "secondary";

  const closedLabel = status.warnings
    .find((warning) => warning.includes("office is closed"))
    ?.replace(" — the office is closed.", "");
  const hasCheckIn = Boolean(status.attendanceDay?.checkInAt);
  const showingOfficeClosed = status.isWeekendOff && !hasCheckIn;
  const stateLabel = showingOfficeClosed
    ? (closedLabel ?? "Office closed")
    : STATE_LABELS[status.state];
  const badgeLabel = showingOfficeClosed ? "office closed" : status.state.replaceAll("_", " ");

  return (
    <Card className="relative overflow-hidden border-white/10 bg-[#0a1230]/90 ring-white/10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_0%_0%,#464c9f30,transparent_55%)]"
      />
      <CardContent className="relative flex items-center justify-between gap-4 pt-4">
        <div>
          <p className="font-mono text-[11px] font-medium tracking-[0.18em] text-[#a8aec4] uppercase">
            Status
          </p>
          <p className="mt-1 text-xl font-semibold tracking-tight text-white">{stateLabel}</p>
        </div>
        <Badge variant={stateBadgeVariant}>{badgeLabel}</Badge>
      </CardContent>
      <CardContent className="relative pt-0">
        {elapsedShiftSeconds != null && (
          <p className="mt-3 font-mono text-lg font-semibold tabular-nums text-[#eceef5]">
            Shift time: {formatShiftDuration(elapsedShiftSeconds)}
          </p>
        )}
        {status.attendanceDay?.checkInAt && (
          <p className="mt-3 text-[#a8aec4] text-sm">
            Check-in: {formatPktTime(status.attendanceDay.checkInAt)}
            {status.attendanceDay.isLate ? " (late)" : ""}
          </p>
        )}
        {status.attendanceDay?.checkOutAt ? (
          <p className="text-[#a8aec4] text-sm">
            Check-out: {formatPktTime(status.attendanceDay.checkOutAt)}
            {status.attendanceDay.isEarlyLeave ? " (early)" : ""}
          </p>
        ) : status.attendanceDay?.checkInAt ? (
          <p className="text-[#a8aec4] text-sm">Check-out: —</p>
        ) : null}
        {status.attendanceDay?.isMissedCheckout && !status.attendanceDay.checkOutAt && (
          <p className="text-amber-300 text-sm">Present — check-out not recorded yet</p>
        )}

        {status.state !== "checked_out" && (
          <p className="mt-3 text-[#a8aec4] text-sm">
            Break used: {formatShiftDuration(liveBreakSeconds)} / 60:00 · Remaining:&nbsp;
            {formatShiftDuration(Math.max(0, MAX_BREAK_SECONDS - liveBreakSeconds))}
          </p>
        )}

        <div className="mt-4 rounded-lg border border-white/10 bg-[#050d22]/60 px-3 py-2.5">
          <p className="font-medium text-sm text-[#eceef5]">Monthly late check-ins</p>
          <p className="mt-1 text-[#a8aec4] text-sm">
            {status.monthlyLate.lateCount} late this month · {status.monthlyLate.freeLatesRemaining}
            &nbsp; of {MONTHLY_LATE_ALLOWANCE} free remaining
          </p>
          {status.monthlyLate.finesWaived ? (
            <p className="mt-1 text-emerald-300 text-sm">
              Late fines for this month are waived by an approved relaxation.
            </p>
          ) : null}
          {status.monthlyLate.totalFinePkr > 0 && (
            <p className="mt-1 text-amber-300 text-sm">
              Fines so far: {formatLateFinePkr(status.monthlyLate.totalFinePkr)}
            </p>
          )}
          {!status.monthlyLate.finesWaived &&
            status.monthlyLate.freeLatesRemaining === 0 &&
            status.monthlyLate.totalFinePkr === 0 && (
              <p className="mt-1 text-amber-300 text-sm">
                Next late check-in will incur a {formatLateFinePkr(LATE_FINE_AMOUNT_PKR)} fine.
              </p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
