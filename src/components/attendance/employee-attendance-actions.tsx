"use client";

import { Coffee, LogIn, LogOut, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SerializedTodayStatus } from "@/lib/attendance/serialize";
import { cn } from "@/lib/utils";

type EmployeeAttendanceActionsProps = {
  status: SerializedTodayStatus;
  acting: boolean;
  showEarlyConfirm: boolean;
  onCheckIn: () => void;
  onStartBreak: () => void;
  onEndBreak: () => void;
  onCheckOut: () => void;
};

export function EmployeeAttendanceActions({
  status,
  acting,
  showEarlyConfirm,
  onCheckIn,
  onStartBreak,
  onEndBreak,
  onCheckOut,
}: EmployeeAttendanceActionsProps) {
  return (
    <section className="relative overflow-hidden rounded-xl border border-white/15 bg-[#0a1230] p-3.5 sm:p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,#f26b2114,transparent_60%)]"
      />
      <div className="relative space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#f26b21] uppercase">
              Actions
            </p>
            <h2 className="text-base font-semibold text-white">Punch for this shift</h2>
          </div>
          <p className="text-xs text-[#9aa3b8]">Geofence required</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-2.5">
          <Button
            className={cn(
              "h-12 touch-manipulation flex-col gap-0.5 text-xs font-semibold shadow-[0_12px_40px_-16px_rgba(242,107,33,0.7)] sm:h-14 sm:text-sm",
            )}
            disabled={acting || !status.actions.canCheckIn}
            onClick={onCheckIn}
          >
            <LogIn className="size-3.5 opacity-90 sm:size-4" aria-hidden />
            Check in
          </Button>
          <Button
            variant="secondary"
            className="h-12 touch-manipulation flex-col gap-0.5 border border-white/15 bg-[#14204a] text-xs font-semibold text-white hover:bg-[#1a2958] sm:h-14 sm:text-sm"
            disabled={acting || !status.actions.canStartBreak}
            onClick={onStartBreak}
          >
            <Coffee className="size-3.5 opacity-90 sm:size-4" aria-hidden />
            Start break
          </Button>
          <Button
            variant="secondary"
            className="h-12 touch-manipulation flex-col gap-0.5 border border-white/15 bg-[#14204a] text-xs font-semibold text-white hover:bg-[#1a2958] sm:h-14 sm:text-sm"
            disabled={acting || !status.actions.canEndBreak}
            onClick={onEndBreak}
          >
            <Pause className="size-3.5 opacity-90 sm:size-4" aria-hidden />
            End break
          </Button>
          <Button
            variant="outline"
            className="h-12 touch-manipulation flex-col gap-0.5 border-white/25 bg-white/[0.04] text-xs font-semibold text-white hover:bg-white/10 sm:h-14 sm:text-sm"
            disabled={acting || !status.actions.canCheckOut || showEarlyConfirm}
            onClick={onCheckOut}
          >
            <LogOut className="size-3.5 opacity-90 sm:size-4" aria-hidden />
            Check out
          </Button>
        </div>
      </div>
    </section>
  );
}
