"use client";

import { Button } from "@/components/ui/button";
import type { SerializedTodayStatus } from "@/lib/attendance/serialize";

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
    <div className="grid gap-3 sm:grid-cols-2">
      <Button
        className="h-12 text-base font-medium shadow-[0_12px_40px_-16px_rgba(242,107,33,0.7)]"
        disabled={acting || !status.actions.canCheckIn}
        onClick={onCheckIn}
      >
        Check in
      </Button>
      <Button
        variant="secondary"
        className="h-12 border border-white/10 bg-[#14204a] text-base text-[#eceef5] hover:bg-[#1a2958]"
        disabled={acting || !status.actions.canStartBreak}
        onClick={onStartBreak}
      >
        Start break
      </Button>
      <Button
        variant="secondary"
        className="h-12 border border-white/10 bg-[#14204a] text-base text-[#eceef5] hover:bg-[#1a2958]"
        disabled={acting || !status.actions.canEndBreak}
        onClick={onEndBreak}
      >
        End break
      </Button>
      <Button
        variant="outline"
        className="h-12 border-white/20 bg-transparent text-base text-[#eceef5] hover:bg-white/5"
        disabled={acting || !status.actions.canCheckOut || showEarlyConfirm}
        onClick={onCheckOut}
      >
        Check out
      </Button>
    </div>
  );
}
