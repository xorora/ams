"use client";

import { useEffect, useState } from "react";
import { formatPktTime, formatShiftDuration } from "@/lib/admin/display";
import {
  formatLateFinePkr,
  LATE_FINE_AMOUNT_PKR,
  MONTHLY_LATE_ALLOWANCE,
} from "@/lib/attendance/late-fines-utils";
import { getLiveBreakSeconds, getLiveElapsedShiftSeconds } from "@/lib/attendance/live-shift-time";
import type { SerializedTodayStatus } from "@/lib/attendance/serialize";
import type { WorkState } from "@/lib/attendance/status";
import { cn } from "@/lib/utils";

const STATE_LABELS: Record<WorkState, string> = {
  not_checked_in: "Not checked in",
  checked_in: "Checked in",
  on_break: "On break",
  checked_out: "Checked out",
};

type EmployeeStatusCardProps = {
  status: SerializedTodayStatus;
};

function statusTone(state: WorkState, officeClosed: boolean) {
  if (officeClosed) {
    return "border-white/20 bg-white/10 text-white";
  }
  switch (state) {
    case "checked_in":
      return "border-emerald-400/40 bg-emerald-400/15 text-emerald-200";
    case "on_break":
      return "border-amber-400/40 bg-amber-400/15 text-amber-100";
    case "checked_out":
      return "border-[#6b70b6]/50 bg-[#464c9f]/30 text-[#d7dbf5]";
    default:
      return "border-[#f26b21]/40 bg-[#f26b21]/15 text-[#ffc9a3]";
  }
}

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

  const closedLabel = status.warnings
    .find((warning) => warning.includes("office is closed"))
    ?.replace(" — the office is closed.", "");
  const hasCheckIn = Boolean(status.attendanceDay?.checkInAt);
  const showingOfficeClosed = status.isWeekendOff && !hasCheckIn;
  const stateLabel = showingOfficeClosed
    ? (closedLabel ?? "Office closed")
    : STATE_LABELS[status.state];
  const badgeLabel = showingOfficeClosed ? "office closed" : status.state.replaceAll("_", " ");

  const maxBreakSeconds = status.maxBreakSeconds || 3600;
  const breakRemaining = Math.max(0, maxBreakSeconds - liveBreakSeconds);
  const breakPct = Math.min(100, Math.round((liveBreakSeconds / maxBreakSeconds) * 100));

  return (
    <section className="relative overflow-hidden rounded-xl border border-white/15 bg-[#0a1230]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_0%_0%,#464c9f40,transparent_55%)]"
      />

      <div className="relative flex h-full flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#f26b21] uppercase">
              Today
            </p>
            <h2 className="mt-0.5 truncate text-lg font-semibold tracking-tight text-white sm:text-xl">
              {stateLabel}
            </h2>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold capitalize",
              statusTone(status.state, showingOfficeClosed),
            )}
          >
            {badgeLabel}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <p className="text-[10px] font-medium text-[#c8cce0]">Shift</p>
            <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-white">
              {elapsedShiftSeconds != null ? formatShiftDuration(elapsedShiftSeconds) : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <p className="text-[10px] font-medium text-[#c8cce0]">In</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {status.attendanceDay?.checkInAt
                ? formatPktTime(status.attendanceDay.checkInAt)
                : "—"}
              {status.attendanceDay?.isLate ? (
                <span className="ml-1 text-[10px] font-medium text-amber-200">late</span>
              ) : null}
            </p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
            <p className="text-[10px] font-medium text-[#c8cce0]">Out</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-white">
              {status.attendanceDay?.checkOutAt
                ? formatPktTime(status.attendanceDay.checkOutAt)
                : "—"}
              {status.attendanceDay?.isEarlyLeave ? (
                <span className="ml-1 text-[10px] font-medium text-amber-200">early</span>
              ) : null}
            </p>
          </div>
        </div>

        {status.attendanceDay?.isMissedCheckout && !status.attendanceDay.checkOutAt ? (
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-xs font-medium text-amber-100">
            Present — check-out not recorded yet
          </p>
        ) : null}

        {status.state !== "checked_out" ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <p className="text-[#c8cce0]">
                Break{" "}
                <span className="font-mono font-semibold text-white">
                  {formatShiftDuration(liveBreakSeconds)}
                </span>
                <span className="text-[#9aa3b8]"> / 60:00</span>
              </p>
              <p className="font-mono font-semibold text-white">
                {formatShiftDuration(breakRemaining)} left
              </p>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#464c9f] to-[#f26b21] transition-[width] duration-500"
                style={{ width: `${breakPct}%` }}
              />
            </div>
          </div>
        ) : null}

        <p className="text-xs leading-relaxed text-[#d7dceb]">
          <span className="font-semibold text-white">{status.monthlyLate.lateCount}</span> late this
          month ·{" "}
          <span className="font-semibold text-white">{status.monthlyLate.freeLatesRemaining}</span> of{" "}
          {MONTHLY_LATE_ALLOWANCE} free left
          {status.monthlyLate.finesWaived ? (
            <span className="text-emerald-200"> · fines waived</span>
          ) : status.monthlyLate.totalFinePkr > 0 ? (
            <span className="text-amber-100">
              {" "}
              · {formatLateFinePkr(status.monthlyLate.totalFinePkr)} fines
            </span>
          ) : !status.monthlyLate.finesWaived && status.monthlyLate.freeLatesRemaining === 0 ? (
            <span className="text-amber-100">
              {" "}
              · next late {formatLateFinePkr(LATE_FINE_AMOUNT_PKR)}
            </span>
          ) : null}
        </p>
      </div>
    </section>
  );
}
