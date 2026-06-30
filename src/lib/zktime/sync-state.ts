import { eq } from "drizzle-orm";
import { db } from "@/db";
import { syncState } from "@/db/schema";
import { getTodayAttendanceSyncSince } from "@/lib/zktime/config";

export const ZKTIME_LAST_ATTENDANCE_UPLOAD_TIME = "zktime_last_attendance_upload_time";
export const ZKTIME_LAST_EMPLOYEE_SYNC_AT = "zktime_last_employee_sync_at";
export const ZKTIME_LAST_TERMINAL_SYNC_AT = "zktime_last_terminal_sync_at";
export const ZKTIME_LAST_EMPLOYEE_PUSH_AT = "zktime_last_employee_push_at";

export async function getSyncStateValue(key: string): Promise<string | null> {
  const row = await db.query.syncState.findFirst({
    where: eq(syncState.key, key),
  });
  return row?.value ?? null;
}

export async function setSyncStateValue(key: string, value: string): Promise<void> {
  await db
    .insert(syncState)
    .values({ key, value })
    .onConflictDoUpdate({
      target: syncState.key,
      set: { value, updatedAt: new Date() },
    });
}

export async function getLastAttendanceUploadTime(): Promise<string> {
  const stored = await getSyncStateValue(ZKTIME_LAST_ATTENDANCE_UPLOAD_TIME);
  return stored ?? getTodayAttendanceSyncSince();
}

export async function setLastAttendanceUploadTime(value: string): Promise<void> {
  await setSyncStateValue(ZKTIME_LAST_ATTENDANCE_UPLOAD_TIME, value);
}
