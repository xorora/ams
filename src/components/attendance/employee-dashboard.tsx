"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { EmployeeAttendanceActions } from "@/components/attendance/employee-attendance-actions";
import { EmployeeClockCard } from "@/components/attendance/employee-clock-card";
import { EmployeeEarlyCheckoutAlert } from "@/components/attendance/employee-early-checkout-alert";
import { EmployeeStatusCard } from "@/components/attendance/employee-status-card";
import { EmployeeDashboardLeaveOverview } from "@/components/leave/employee-dashboard-leave-overview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PKT_CLOCK_12H_FORMAT } from "@/lib/admin/display";
import {
  checkInAction,
  checkOutAction,
  endBreakAction,
  loadTodayStatusAction,
  startBreakAction,
} from "@/lib/attendance/actions";
import {
  BUSINESS_TIMEZONE,
  LATE_FINE_AMOUNT_PKR,
  MONTHLY_LATE_ALLOWANCE,
} from "@/lib/attendance/constants";
import { formatLateFinePkr } from "@/lib/attendance/late-fines-utils";
import type { SerializedTodayStatus } from "@/lib/attendance/serialize";
import type { LeaveBalance, UnpaidLeaveSummary } from "@/lib/leave/types";
import { toast, toastError } from "@/lib/toast";

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 60_000,
    });
  });
}

function geolocationErrorMessage(error: GeolocationPositionError | Error): string {
  if ("code" in error) {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return "Location permission denied. Enable location access to check in.";
      case error.POSITION_UNAVAILABLE:
        return "Location unavailable. Try again near a window or outdoors.";
      case error.TIMEOUT:
        return "Location request timed out. Please try again.";
      default:
        return error.message;
    }
  }
  return error.message;
}

type EmployeeDashboardProps = {
  initialStatus: SerializedTodayStatus | null;
  loadError: string | null;
  showLeaveOverview?: boolean;
  probationUnpaidOnly?: boolean;
  leaveBalances?: LeaveBalance[];
  unpaidSummary?: UnpaidLeaveSummary;
};

export function EmployeeDashboard({
  initialStatus,
  loadError,
  showLeaveOverview = false,
  probationUnpaidOnly = false,
  leaveBalances = [],
  unpaidSummary = { used: 0, pending: 0, total: 0 },
}: EmployeeDashboardProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [status, setStatus] = useState<SerializedTodayStatus | null>(initialStatus);
  const [pktClock, setPktClock] = useState("");
  const [acting, setActing] = useState(false);
  const [showEarlyConfirm, setShowEarlyConfirm] = useState(false);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    if (loadError) {
      toastError(loadError);
    }
  }, [loadError]);

  const refresh = useCallback(async () => {
    const result = await loadTodayStatusAction();
    if (!result.ok) {
      throw new Error(result.error);
    }
    setStatus(result.data);
  }, []);

  useEffect(() => {
    const tick = () => {
      setPktClock(formatInTimeZone(new Date(), BUSINESS_TIMEZONE, PKT_CLOCK_12H_FORMAT));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (status?.state !== "on_break" || !status.activeBreakStartedAt) {
      return;
    }
    const id = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(id);
  }, [status, refresh]);

  const runAction = async (
    action: (
      coords: { lat: number; lng: number },
      options?: { confirmEarlyLeave?: boolean },
    ) => Promise<
      | { ok: true; data: { message: string; status: SerializedTodayStatus } }
      | { ok: false; error: string; code?: string }
    >,
    options?: { confirmEarlyLeave?: boolean; loadingMessage?: string },
  ): Promise<boolean> => {
    setActing(true);
    const toastId = toast.loading(options?.loadingMessage ?? "Processing…");
    try {
      const position = await getCurrentPosition();
      const coords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      const result = await action(coords, options);
      if (!result.ok) {
        if (result.code === "EARLY_LEAVE_CONFIRM_REQUIRED") {
          setShowEarlyConfirm(true);
          toast.error(result.error, { id: toastId });
          return false;
        }
        throw new Error(result.error);
      }
      setStatus(result.data.status);
      setShowEarlyConfirm(false);
      toast.success(result.data.message, { id: toastId });
      startTransition(() => router.refresh());
      return true;
    } catch (e) {
      const text =
        e instanceof GeolocationPositionError || e instanceof Error
          ? geolocationErrorMessage(e as GeolocationPositionError)
          : "Action failed";
      toast.error(text, { id: toastId });
      return false;
    } finally {
      setActing(false);
    }
  };

  if (!status) {
    return <p className="text-destructive text-sm">Unable to load attendance. Refresh the page.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {status.employeeInactive && (
        <Alert variant="destructive">
          <AlertTitle>Account deactivated</AlertTitle>
          <AlertDescription>
            Your employee record has been deactivated. Contact HR if you believe this is a mistake.
          </AlertDescription>
        </Alert>
      )}

      <EmployeeClockCard pktClock={pktClock} shiftDate={status.shiftDate} />
      <EmployeeStatusCard status={status} />

      {showLeaveOverview ? (
        <EmployeeDashboardLeaveOverview
          probationUnpaidOnly={probationUnpaidOnly}
          balances={leaveBalances}
          unpaidSummary={unpaidSummary}
        />
      ) : null}

      {status.warnings.length > 0 && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950">
          <AlertTitle>Notice</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {status.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {showEarlyConfirm && !status.employeeInactive && (
        <EmployeeEarlyCheckoutAlert
          expectedCheckOutTime={status.shiftSchedule.expectedCheckOutTime}
          acting={acting}
          onConfirm={() =>
            void runAction((coords, opts) => checkOutAction(coords, opts), {
              confirmEarlyLeave: true,
              loadingMessage: "Checking out…",
            })
          }
          onCancel={() => setShowEarlyConfirm(false)}
        />
      )}

      {status.isWeekendOff && !status.employeeInactive && (
        <Alert>
          <AlertTitle>Office closed</AlertTitle>
          <AlertDescription>
            {status.warnings.find((warning) => warning.includes("office is closed")) ??
              "The office is closed today."}{" "}
            Attendance actions are disabled until the next working day.
          </AlertDescription>
        </Alert>
      )}

      {!status.employeeInactive &&
        (!status.isWeekendOff ||
          status.actions.canCheckOut ||
          status.actions.canStartBreak ||
          status.actions.canEndBreak) && (
          <EmployeeAttendanceActions
            status={status}
            acting={acting}
            showEarlyConfirm={showEarlyConfirm}
            onCheckIn={() =>
              void runAction((coords) => checkInAction(coords), {
                loadingMessage: "Checking in…",
              })
            }
            onStartBreak={() =>
              void runAction((coords) => startBreakAction(coords), {
                loadingMessage: "Starting break…",
              })
            }
            onEndBreak={() =>
              void runAction((coords) => endBreakAction(coords), {
                loadingMessage: "Ending break…",
              })
            }
            onCheckOut={() =>
              void runAction((coords, opts) => checkOutAction(coords, opts), {
                loadingMessage: "Checking out…",
              })
            }
          />
        )}

      {!status.employeeInactive &&
        (!status.isWeekendOff ||
          status.actions.canCheckOut ||
          status.actions.canStartBreak ||
          status.actions.canEndBreak) && (
          <p className="text-muted-foreground text-xs">
            Actions require your location and you must be within the office geofence. Expected
            shift: check-in by {status.shiftSchedule.lateCheckInDeadline} (
            {status.shiftSchedule.checkInGraceMinutes} min grace), check-out by&nbsp;
            {status.shiftSchedule.lateCheckOutDeadline} ({status.shiftSchedule.checkOutGraceMinutes}
            &nbsp; min grace after {status.shiftSchedule.expectedCheckOutTime}). Missing check-out
            after the grace period marks the shift absent. You get&nbsp;
            {MONTHLY_LATE_ALLOWANCE}&nbsp;free late check-ins per month; each additional late
            costs&nbsp;
            {formatLateFinePkr(LATE_FINE_AMOUNT_PKR)}.
          </p>
        )}
    </div>
  );
}
