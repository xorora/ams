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
  const capMs = toMs(status.openShiftElapsedCapAt);

  if (
    status.state === "on_break" &&
    statusAtMs != null &&
    activeStartMs != null &&
    !status.attendanceDay?.checkOutAt
  ) {
    const effectiveNowMs = capMs != null ? Math.min(nowMs, capMs) : nowMs;
    const effectiveStatusAtMs = capMs != null ? Math.min(statusAtMs, capMs) : statusAtMs;
    const activeAtStatus = Math.max(0, Math.floor((effectiveStatusAtMs - activeStartMs) / 1000));
    const activeNow = Math.max(0, Math.floor((effectiveNowMs - activeStartMs) / 1000));
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
  const capMs = toMs(status.openShiftElapsedCapAt);
  let endMs = checkOutMs ?? now.getTime();
  if (checkOutMs == null && capMs != null && endMs > capMs) {
    endMs = capMs;
  }
  const grossSeconds = Math.max(0, Math.floor((endMs - checkInMs) / 1000));
  const breakSeconds = checkOutMs != null ? status.totalBreakSeconds : getLiveBreakSeconds(status, now);

  return Math.max(0, grossSeconds - breakSeconds);
}
