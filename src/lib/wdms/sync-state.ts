import { eq } from "drizzle-orm";
import { db } from "@/db";
import { syncState } from "@/db/schema";

export const WDMS_LAST_ATTENDANCE_UPLOAD_TIME = "wdms_last_attendance_upload_time";
export const WDMS_LAST_EMPLOYEE_SYNC_AT = "wdms_last_employee_sync_at";
export const WDMS_LAST_TERMINAL_SYNC_AT = "wdms_last_terminal_sync_at";
export const WDMS_LAST_COMPANY_PUSH_AT = "wdms_last_company_push_at";

const DEFAULT_ATTENDANCE_CURSOR = "2000-01-01 00:00:00";

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
  return (await getSyncStateValue(WDMS_LAST_ATTENDANCE_UPLOAD_TIME)) ?? DEFAULT_ATTENDANCE_CURSOR;
}

export async function setLastAttendanceUploadTime(value: string): Promise<void> {
  await setSyncStateValue(WDMS_LAST_ATTENDANCE_UPLOAD_TIME, value);
}
