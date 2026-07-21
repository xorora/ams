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
    <section className="relative overflow-hidden rounded-2xl border border-white/15 bg-[#0a1230] p-5 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.55)] sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,#f26b2118,transparent_60%)]"
      />
      <div className="relative space-y-4">
        <div>
          <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-[#f26b21] uppercase">
            Actions
          </p>
          <h2 className="mt-1 text-lg font-semibold text-white">Punch for this shift</h2>
          <p className="mt-1 text-sm text-[#d7dceb]">
            Location and office geofence are required for every action.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            className={cn(
              "h-14 touch-manipulation flex-col gap-1 text-sm font-semibold shadow-[0_12px_40px_-16px_rgba(242,107,33,0.7)] sm:h-16 sm:text-base",
            )}
            disabled={acting || !status.actions.canCheckIn}
            onClick={onCheckIn}
          >
            <LogIn className="size-4 opacity-90" aria-hidden />
            Check in
          </Button>
          <Button
            variant="secondary"
            className="h-14 touch-manipulation flex-col gap-1 border border-white/15 bg-[#14204a] text-sm font-semibold text-white hover:bg-[#1a2958] sm:h-16 sm:text-base"
            disabled={acting || !status.actions.canStartBreak}
            onClick={onStartBreak}
          >
            <Coffee className="size-4 opacity-90" aria-hidden />
            Start break
          </Button>
          <Button
            variant="secondary"
            className="h-14 touch-manipulation flex-col gap-1 border border-white/15 bg-[#14204a] text-sm font-semibold text-white hover:bg-[#1a2958] sm:h-16 sm:text-base"
            disabled={acting || !status.actions.canEndBreak}
            onClick={onEndBreak}
          >
            <Pause className="size-4 opacity-90" aria-hidden />
            End break
          </Button>
          <Button
            variant="outline"
            className="h-14 touch-manipulation flex-col gap-1 border-white/25 bg-white/[0.04] text-sm font-semibold text-white hover:bg-white/10 sm:h-16 sm:text-base"
            disabled={acting || !status.actions.canCheckOut || showEarlyConfirm}
            onClick={onCheckOut}
          >
            <LogOut className="size-4 opacity-90" aria-hidden />
            Check out
          </Button>
        </div>
      </div>
    </section>
  );
}
