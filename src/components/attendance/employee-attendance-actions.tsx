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
    <div className="grid gap-2 sm:grid-cols-2">
      <Button disabled={acting || !status.actions.canCheckIn} onClick={onCheckIn}>
        Check in
      </Button>
      <Button
        variant="secondary"
        disabled={acting || !status.actions.canStartBreak}
        onClick={onStartBreak}
      >
        Start break
      </Button>
      <Button
        variant="secondary"
        disabled={acting || !status.actions.canEndBreak}
        onClick={onEndBreak}
      >
        End break
      </Button>
      <Button
        variant="outline"
        disabled={acting || !status.actions.canCheckOut || showEarlyConfirm}
        onClick={onCheckOut}
      >
        Check out
      </Button>
    </div>
  );
}
