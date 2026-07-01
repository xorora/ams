import type { TodayStatusPayload } from "./status";

export type SerializedTodayStatus = Omit<TodayStatusPayload, "attendanceDay" | "breakSessions"> & {
  attendanceDay:
    | (Omit<NonNullable<TodayStatusPayload["attendanceDay"]>, "checkInAt" | "checkOutAt"> & {
        checkInAt: string | null;
        checkOutAt: string | null;
      })
    | null;
};

export function serializeTodayStatus(payload: TodayStatusPayload): SerializedTodayStatus {
  const { breakSessions: _sessions, attendanceDay, ...rest } = payload;
  return {
    ...rest,
    attendanceDay: attendanceDay
      ? {
          ...attendanceDay,
          checkInAt: attendanceDay.checkInAt?.toISOString() ?? null,
          checkOutAt: attendanceDay.checkOutAt?.toISOString() ?? null,
        }
      : null,
  };
}
