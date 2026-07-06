import type { SerializedTodayStatus } from "./serialize";

function toMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  return new Date(value).getTime();
}

/** Break seconds at `statusAt`, advanced to `now` when an active break is running. */
export function getLiveBreakSeconds(status: SerializedTodayStatus, now: Date = new Date()): number {
  const statusAtMs = toMs(status.statusAt);
  const activeStartMs = toMs(status.activeBreakStartedAt);
  const nowMs = now.getTime();

  if (
    status.state === "on_break" &&
    statusAtMs != null &&
    activeStartMs != null &&
    !status.attendanceDay?.checkOutAt
  ) {
    const activeAtStatus = Math.max(0, Math.floor((statusAtMs - activeStartMs) / 1000));
    const activeNow = Math.max(0, Math.floor((nowMs - activeStartMs) / 1000));
    return status.totalBreakSeconds + (activeNow - activeAtStatus);
  }

  return status.totalBreakSeconds;
}

/** Net working seconds for the open or completed shift, ticking only while not on break. */
export function getLiveElapsedShiftSeconds(
  status: SerializedTodayStatus,
  now: Date = new Date(),
): number | null {
  const checkInMs = toMs(status.attendanceDay?.checkInAt);
  if (checkInMs == null) {
    return status.elapsedShiftSeconds;
  }

  const checkOutMs = toMs(status.attendanceDay?.checkOutAt);
  const endMs = checkOutMs ?? now.getTime();
  const grossSeconds = Math.max(0, Math.floor((endMs - checkInMs) / 1000));
  const breakSeconds = checkOutMs != null ? status.totalBreakSeconds : getLiveBreakSeconds(status, now);

  return Math.max(0, grossSeconds - breakSeconds);
}
