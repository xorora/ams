"use client";

import { formatInTimeZone } from "date-fns-tz";
import { useCallback, useEffect, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BUSINESS_TIMEZONE } from "@/lib/attendance/constants";
import type { SerializedTodayStatus } from "@/lib/attendance/serialize";
import type { WorkState } from "@/lib/attendance/status";

type ActionResponse = {
  message: string;
  status: SerializedTodayStatus;
};

type ApiError = {
  error: string;
  code?: string;
};

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

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15_000,
      maximumAge: 0,
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

export function EmployeeDashboard() {
  const [status, setStatus] = useState<SerializedTodayStatus | null>(null);
  const [pktClock, setPktClock] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );
  const [showEarlyConfirm, setShowEarlyConfirm] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/attendance/today");
    if (!res.ok) {
      const err = (await res.json()) as ApiError;
      throw new Error(err.error ?? "Failed to load attendance status");
    }
    const data = (await res.json()) as SerializedTodayStatus;
    setStatus(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch (e) {
        if (!cancelled) {
          setFeedback({
            type: "error",
            text: e instanceof Error ? e.message : "Failed to load status",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    const tick = () => {
      setPktClock(formatInTimeZone(new Date(), BUSINESS_TIMEZONE, "EEEE, d MMM yyyy · HH:mm:ss"));
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

  const runAction = async (path: string, extraBody?: Record<string, unknown>): Promise<boolean> => {
    setActing(true);
    setFeedback(null);
    try {
      const position = await getCurrentPosition();
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          ...extraBody,
        }),
      });
      const data = (await res.json()) as ActionResponse & ApiError;
      if (!res.ok) {
        if (data.code === "EARLY_LEAVE_CONFIRM_REQUIRED") {
          setShowEarlyConfirm(true);
          setFeedback({ type: "error", text: data.error });
          return false;
        }
        throw new Error(data.error ?? "Action failed");
      }
      setStatus(data.status);
      setShowEarlyConfirm(false);
      setFeedback({ type: "success", text: data.message });
      return true;
    } catch (e) {
      const text =
        e instanceof GeolocationPositionError || e instanceof Error
          ? geolocationErrorMessage(e as GeolocationPositionError)
          : "Action failed";
      setFeedback({ type: "error", text });
      return false;
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return <p className="text-muted-foreground text-sm">Loading attendance…</p>;
  }

  if (!status) {
    return (
      <p className="text-destructive text-sm">
        {feedback?.text ?? "Unable to load attendance. Refresh the page."}
      </p>
    );
  }

  const stateBadgeVariant =
    status.state === "on_break"
      ? "outline"
      : status.state === "checked_in"
        ? "default"
        : "secondary";

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Pakistan Standard Time
          </CardTitle>
        </CardHeader>
        <CardContent className="-mt-2">
          <p className="font-mono text-2xl font-semibold tabular-nums">{pktClock}</p>
          <p className="mt-2 text-muted-foreground text-sm">
            Shift date: <span className="font-medium text-foreground">{status.shiftDate}</span>
          </p>
        </CardContent>
      </Card>

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
              Check-in:{" "}
              {formatInTimeZone(status.attendanceDay.checkInAt, BUSINESS_TIMEZONE, "HH:mm")}
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

      {feedback && (
        <Alert variant={feedback.type === "error" ? "destructive" : "default"}>
          <AlertDescription>{feedback.text}</AlertDescription>
        </Alert>
      )}

      {showEarlyConfirm && (
        <Alert className="border-amber-300 bg-amber-50 text-amber-950">
          <AlertTitle>Early check-out</AlertTitle>
          <AlertDescription>
            You are checking out before 03:00 PKT. This will be recorded as early leave.
          </AlertDescription>
          <div className="mt-4 flex flex-wrap gap-2 px-4 pb-4">
            <Button
              variant="destructive"
              disabled={acting}
              onClick={() =>
                void runAction("/api/attendance/check-out", { confirmEarlyLeave: true })
              }
            >
              Confirm check-out
            </Button>
            <Button variant="outline" disabled={acting} onClick={() => setShowEarlyConfirm(false)}>
              Cancel
            </Button>
          </div>
        </Alert>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          disabled={acting || !status.actions.canCheckIn}
          onClick={() => void runAction("/api/attendance/check-in")}
        >
          Check in
        </Button>
        <Button
          variant="secondary"
          disabled={acting || !status.actions.canStartBreak}
          onClick={() => void runAction("/api/attendance/break/start")}
        >
          Start break
        </Button>
        <Button
          variant="secondary"
          disabled={acting || !status.actions.canEndBreak}
          onClick={() => void runAction("/api/attendance/break/end")}
        >
          End break
        </Button>
        <Button
          variant="outline"
          disabled={acting || !status.actions.canCheckOut || showEarlyConfirm}
          onClick={() => void runAction("/api/attendance/check-out")}
        >
          Check out
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Actions require your location and you must be within the office geofence. Expected shift:
        check-in by 18:30 PKT, check-out at 03:00 PKT.
      </p>
    </div>
  );
}
