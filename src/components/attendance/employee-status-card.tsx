"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatShiftDuration } from "@/lib/admin/display";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import type { SerializedTodayStatus } from "@/lib/attendance/serialize";
import type { WorkState } from "@/lib/attendance/status";

const STATE_LABELS: Record<WorkState, string> = {
  not_checked_in: "Not checked in",
  checked_in: "Checked in",
  on_break: "On break",
  checked_out: "Checked out",
};

function getLiveElapsedShiftSeconds(status: SerializedTodayStatus, now: Date): number | null {
  if (status.elapsedShiftSeconds == null) {
    return null;
  }
  if (status.state !== "checked_in" && status.state !== "on_break") {
    return status.elapsedShiftSeconds;
  }
  const statusAt = new Date(status.statusAt).getTime();
  const deltaSeconds = Math.max(0, Math.floor((now.getTime() - statusAt) / 1000));
  return status.elapsedShiftSeconds + deltaSeconds;
}

function getLiveOvertimeSeconds(status: SerializedTodayStatus, now: Date): number {
  if (!status.overtime.isActive) {
    return status.overtime.elapsedSeconds;
  }
  const statusAt = new Date(status.statusAt).getTime();
  const deltaSeconds = Math.max(0, Math.floor((now.getTime() - statusAt) / 1000));
  return status.overtime.elapsedSeconds + deltaSeconds;
}

type EmployeeStatusCardProps = {
  status: SerializedTodayStatus;
};

export function EmployeeStatusCard({ status }: EmployeeStatusCardProps) {
  const [elapsedShiftSeconds, setElapsedShiftSeconds] = useState<number | null>(() =>
    getLiveElapsedShiftSeconds(status, new Date()),
  );
  const [overtimeSeconds, setOvertimeSeconds] = useState(() =>
    getLiveOvertimeSeconds(status, new Date()),
  );

  useEffect(() => {
    const tick = () => {
      setElapsedShiftSeconds(getLiveElapsedShiftSeconds(status, new Date()));
      setOvertimeSeconds(getLiveOvertimeSeconds(status, new Date()));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  const stateBadgeVariant = status.isWeekendOff
    ? "outline"
    : status.state === "on_break"
      ? "outline"
      : status.state === "checked_in"
        ? "default"
        : "secondary";

  const stateLabel = status.isWeekendOff ? "Weekend — office closed" : STATE_LABELS[status.state];
  const badgeLabel = status.isWeekendOff ? "weekend off" : status.state.replaceAll("_", " ");
  const hasOvertime =
    status.overtime.isActive ||
    status.overtime.elapsedSeconds > 0 ||
    status.overtime.startedAt != null;

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 pt-4">
        <div>
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Status
          </p>
          <p className="mt-1 text-xl font-semibold">{stateLabel}</p>
        </div>
        <Badge variant={stateBadgeVariant}>{badgeLabel}</Badge>
      </CardContent>
      <CardContent className="pt-0">
        {elapsedShiftSeconds != null && (
          <p className="mt-3 font-mono text-lg font-semibold tabular-nums">
            Shift time: {formatShiftDuration(elapsedShiftSeconds)}
          </p>
        )}
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

        {hasOvertime && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-amber-900 text-sm dark:text-amber-200">
                {status.overtime.isActive ? "Overtime in progress" : "Overtime"}
              </p>
              {status.overtime.isActive && (
                <Badge
                  variant="outline"
                  className="border-amber-400 text-amber-800 dark:text-amber-200"
                >
                  Active
                </Badge>
              )}
            </div>
            {status.overtime.startedAt && (
              <p className="mt-1 text-amber-800 text-sm dark:text-amber-300">
                Started:{" "}
                {formatInTimeZone(status.overtime.startedAt, BUSINESS_TIMEZONE, "yyyy-MM-dd HH:mm")}
              </p>
            )}
            {status.overtime.endedAt && (
              <p className="text-amber-800 text-sm dark:text-amber-300">
                Ended:{" "}
                {formatInTimeZone(status.overtime.endedAt, BUSINESS_TIMEZONE, "yyyy-MM-dd HH:mm")}
              </p>
            )}
            <p className="mt-1 font-mono font-semibold text-amber-900 tabular-nums dark:text-amber-100">
              Elapsed: {formatShiftDuration(overtimeSeconds)}
            </p>
          </div>
        )}

        {status.state !== "checked_out" && (
          <p className="mt-3 text-muted-foreground text-sm">
            Break used: {formatShiftDuration(status.totalBreakSeconds)} / 60:00 · Remaining:{" "}
            {formatShiftDuration(status.breakRemainingSeconds)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
