"use client";

import { useEffect, useState } from "react";
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

  const breakRemaining = Math.max(0, MAX_BREAK_SECONDS - liveBreakSeconds);
  const breakPct = Math.min(100, Math.round((liveBreakSeconds / MAX_BREAK_SECONDS) * 100));

  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0a1230] shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_55%_70%_at_0%_0%,#464c9f45,transparent_55%)]"
      />

      <div className="relative flex flex-col gap-5 p-5 sm:p-6 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-[#f26b21] uppercase">
              Today
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white">{stateLabel}</h2>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold capitalize",
              statusTone(status.state, showingOfficeClosed),
            )}
          >
            {badgeLabel}
          </span>
        </div>

        {elapsedShiftSeconds != null ? (
          <div className="rounded-xl border border-white/10 bg-[#050d22]/80 px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-[#c8cce0] uppercase">Shift time</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-white">
              {formatShiftDuration(elapsedShiftSeconds)}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium text-[#c8cce0]">Check-in</p>
            <p className="mt-1 text-base font-semibold text-white">
              {status.attendanceDay?.checkInAt
                ? formatPktTime(status.attendanceDay.checkInAt)
                : "—"}
              {status.attendanceDay?.isLate ? (
                <span className="ml-2 text-sm font-medium text-amber-200">(late)</span>
              ) : null}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-medium text-[#c8cce0]">Check-out</p>
            <p className="mt-1 text-base font-semibold text-white">
              {status.attendanceDay?.checkOutAt
                ? formatPktTime(status.attendanceDay.checkOutAt)
                : status.attendanceDay?.checkInAt
                  ? "—"
                  : "—"}
              {status.attendanceDay?.isEarlyLeave ? (
                <span className="ml-2 text-sm font-medium text-amber-200">(early)</span>
              ) : null}
            </p>
          </div>
        </div>

        {status.attendanceDay?.isMissedCheckout && !status.attendanceDay.checkOutAt ? (
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-100">
            Present — check-out not recorded yet
          </p>
        ) : null}

        {status.state !== "checked_out" ? (
          <div className="space-y-2">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#c8cce0]">Break used</p>
                <p className="mt-0.5 font-mono text-base font-semibold tabular-nums text-white">
                  {formatShiftDuration(liveBreakSeconds)}
                  <span className="text-[#c8cce0]"> / 60:00</span>
                </p>
              </div>
              <p className="text-sm font-medium text-[#eceef5]">
                Remaining{" "}
                <span className="font-mono font-semibold text-white">
                  {formatShiftDuration(breakRemaining)}
                </span>
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#464c9f] to-[#f26b21] transition-[width] duration-500"
                style={{ width: `${breakPct}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-white/12 bg-[#050d22]/90 px-4 py-3.5">
          <p className="text-sm font-semibold text-white">Monthly late check-ins</p>
          <p className="mt-1.5 text-sm leading-relaxed text-[#d7dceb]">
            <span className="font-semibold text-white">{status.monthlyLate.lateCount}</span> late
            this month ·{" "}
            <span className="font-semibold text-white">{status.monthlyLate.freeLatesRemaining}</span>{" "}
            of {MONTHLY_LATE_ALLOWANCE} free remaining
          </p>
          {status.monthlyLate.finesWaived ? (
            <p className="mt-2 text-sm font-medium text-emerald-200">
              Late fines for this month are waived by an approved relaxation.
            </p>
          ) : null}
          {status.monthlyLate.totalFinePkr > 0 ? (
            <p className="mt-2 text-sm font-medium text-amber-100">
              Fines so far: {formatLateFinePkr(status.monthlyLate.totalFinePkr)}
            </p>
          ) : null}
          {!status.monthlyLate.finesWaived &&
          status.monthlyLate.freeLatesRemaining === 0 &&
          status.monthlyLate.totalFinePkr === 0 ? (
            <p className="mt-2 text-sm font-medium text-amber-100">
              Next late check-in will incur a {formatLateFinePkr(LATE_FINE_AMOUNT_PKR)} fine.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
