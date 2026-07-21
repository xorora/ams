"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useCallback, useEffect, useState } from "react";
import { EmployeeAttendanceActions } from "@/components/attendance/employee-attendance-actions";
import { EmployeeClockCard } from "@/components/attendance/employee-clock-card";
import { EmployeeDashboardWeekAttendance } from "@/components/attendance/employee-dashboard-week-attendance";
import { EmployeeEarlyCheckoutAlert } from "@/components/attendance/employee-early-checkout-alert";
import { EmployeeStatusCard } from "@/components/attendance/employee-status-card";
import { EmployeeDashboardLeaveOverview } from "@/components/leave/employee-dashboard-leave-overview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PKT_CLOCK_12H_FORMAT } from "@/lib/admin/display";
import type { SerializedEmployeeReport } from "@/lib/admin/reports-serialize";
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
  weekAttendance?: SerializedEmployeeReport | null;
  weekRange?: { from: string; to: string } | null;
};

export function EmployeeDashboard({
  initialStatus,
  loadError,
  showLeaveOverview = false,
  probationUnpaidOnly = false,
  leaveBalances = [],
  unpaidSummary = { used: 0, pending: 0, total: 0 },
  weekAttendance = null,
  weekRange = null,
}: EmployeeDashboardProps) {
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

  // Soft sync while on break — live timers already tick client-side; poll less often.
  useEffect(() => {
    if (status?.state !== "on_break" || !status.activeBreakStartedAt) {
      return;
    }
    const id = window.setInterval(() => {
      void refresh().catch(() => undefined);
    }, 60_000);
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
      // Status comes back from the action — skip full RSC refresh for snappier UX.
      setStatus(result.data.status);
      setShowEarlyConfirm(false);
      toast.success(result.data.message, { id: toastId });
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
    <div className="flex flex-col gap-3 sm:gap-3.5">
      {status.employeeInactive && (
        <Alert variant="destructive">
          <AlertTitle>Account deactivated</AlertTitle>
          <AlertDescription>
            Your employee record has been deactivated. Contact HR if you believe this is a mistake.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:gap-3.5 lg:grid-cols-2">
        <EmployeeClockCard pktClock={pktClock} shiftDate={status.shiftDate} />
        <EmployeeStatusCard status={status} />
      </div>

      {status.warnings.length > 0 && (
        <Alert className="border-amber-400/40 bg-amber-400/15 py-3 text-amber-50">
          <AlertTitle className="font-semibold text-amber-50">Notice</AlertTitle>
          <AlertDescription className="text-amber-50/95">
            <ul className="list-disc pl-4 text-sm">
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
        <Alert className="border-white/20 bg-[#0a1230] py-3 text-white">
          <AlertTitle className="font-semibold text-white">Office closed</AlertTitle>
          <AlertDescription className="text-[#d7dceb]">
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

      {weekRange ? (
        <EmployeeDashboardWeekAttendance
          days={weekAttendance?.days ?? []}
          range={weekRange}
          summary={weekAttendance?.summary ?? null}
        />
      ) : null}

      {showLeaveOverview ? (
        <EmployeeDashboardLeaveOverview
          probationUnpaidOnly={probationUnpaidOnly}
          balances={leaveBalances}
          unpaidSummary={unpaidSummary}
        />
      ) : null}

      {!status.employeeInactive &&
        (!status.isWeekendOff ||
          status.actions.canCheckOut ||
          status.actions.canStartBreak ||
          status.actions.canEndBreak) && (
          <details className="group rounded-xl border border-white/12 bg-[#050d22]/80 px-4 py-3">
            <summary className="cursor-pointer list-none text-xs font-semibold tracking-wide text-[#f26b21] uppercase marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                Shift rules
                <span className="text-[10px] font-medium tracking-normal text-[#9aa3b8] normal-case group-open:hidden">
                  Show
                </span>
                <span className="hidden text-[10px] font-medium tracking-normal text-[#9aa3b8] normal-case group-open:inline">
                  Hide
                </span>
              </span>
            </summary>
            <p className="mt-2.5 text-sm leading-relaxed text-[#d7dceb]">
              Actions require your location inside the office geofence. Check in by{" "}
              <span className="font-semibold text-white">
                {status.shiftSchedule.lateCheckInDeadline}
              </span>{" "}
              ({status.shiftSchedule.checkInGraceMinutes} min grace). Check out by{" "}
              <span className="font-semibold text-white">
                {status.shiftSchedule.lateCheckOutDeadline}
              </span>{" "}
              ({status.shiftSchedule.checkOutGraceMinutes} min grace after{" "}
              {status.shiftSchedule.expectedCheckOutTime}). Missing check-out after grace marks the
              shift absent. You get{" "}
              <span className="font-semibold text-white">{MONTHLY_LATE_ALLOWANCE}</span> free late
              check-ins per month; each additional late costs{" "}
              <span className="font-semibold text-white">
                {formatLateFinePkr(LATE_FINE_AMOUNT_PKR)}
              </span>
              .
            </p>
          </details>
        )}
    </div>
  );
}
