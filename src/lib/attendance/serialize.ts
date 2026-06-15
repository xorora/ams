import type { TodayStatusPayload } from "./status";

export type SerializedTodayStatus = Omit<
  TodayStatusPayload,
  "attendanceDay" | "breakSessions" | "overtime"
> & {
  attendanceDay:
    | (Omit<
        NonNullable<TodayStatusPayload["attendanceDay"]>,
        "checkInAt" | "checkOutAt" | "overtimeStartedAt" | "overtimeEndedAt"
      > & {
        checkInAt: string | null;
        checkOutAt: string | null;
        overtimeStartedAt: string | null;
        overtimeEndedAt: string | null;
      })
    | null;
  overtime: {
    isActive: boolean;
    startedAt: string | null;
    endedAt: string | null;
    elapsedSeconds: number;
  };
};

export function serializeTodayStatus(payload: TodayStatusPayload): SerializedTodayStatus {
  const { breakSessions: _sessions, attendanceDay, overtime, ...rest } = payload;
  return {
    ...rest,
    overtime: {
      isActive: overtime.isActive,
      startedAt: overtime.startedAt?.toISOString() ?? null,
      endedAt: overtime.endedAt?.toISOString() ?? null,
      elapsedSeconds: overtime.elapsedSeconds,
    },
    attendanceDay: attendanceDay
      ? {
          ...attendanceDay,
          checkInAt: attendanceDay.checkInAt?.toISOString() ?? null,
          checkOutAt: attendanceDay.checkOutAt?.toISOString() ?? null,
          overtimeStartedAt: attendanceDay.overtimeStartedAt?.toISOString() ?? null,
          overtimeEndedAt: attendanceDay.overtimeEndedAt?.toISOString() ?? null,
        }
      : null,
  };
}
