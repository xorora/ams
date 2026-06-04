"use client";

import { formatInTimeZone } from "date-fns-tz";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import type { SerializedTodayStatus } from "@/lib/attendance/serialize";
import type { WorkState } from "@/lib/attendance/status";

const STATE_LABELS: Record<WorkState, string> = {
  not_checked_in: "Not checked in",
  checked_in: "Checked in",
  on_break: "On break",
  checked_out: "Checked out",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

type EmployeeStatusCardProps = {
  status: SerializedTodayStatus;
};

export function EmployeeStatusCard({ status }: EmployeeStatusCardProps) {
  const stateBadgeVariant =
    status.state === "on_break"
      ? "outline"
      : status.state === "checked_in"
        ? "default"
        : "secondary";

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Status
          </p>
          <p className="mt-1 text-xl font-semibold">{STATE_LABELS[status.state]}</p>
        </div>
        <Badge variant={stateBadgeVariant}>{status.state.replaceAll("_", " ")}</Badge>
      </CardContent>
      <CardContent className="pt-0">
        {status.attendanceDay?.checkInAt && (
          <p className="mt-3 text-muted-foreground text-sm">
            Check-in: {formatInTimeZone(status.attendanceDay.checkInAt, BUSINESS_TIMEZONE, "HH:mm")}
            {status.attendanceDay.isLate ? " (late)" : ""}
          </p>
        )}
        {status.attendanceDay?.checkOutAt && (
          <p className="text-muted-foreground text-sm">
            Check-out:{" "}
            {formatInTimeZone(status.attendanceDay.checkOutAt, BUSINESS_TIMEZONE, "HH:mm")}
            {status.attendanceDay.isEarlyLeave ? " (early)" : ""}
          </p>
        )}

        {status.state !== "checked_out" && (
          <p className="text-muted-foreground text-sm">
            Break used: {formatDuration(status.totalBreakSeconds)} / 60:00 · Remaining:{" "}
            {formatDuration(status.breakRemainingSeconds)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
