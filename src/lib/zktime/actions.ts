"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionFailure,
  type ActionResult,
  actionFailure,
  actionSuccess,
} from "@/lib/actions/result";
import { requireAdminSession } from "@/lib/auth/require-session";
import { syncAttendanceFromZktime } from "@/lib/zktime/attendance-sync";
import { ZktimeClient } from "@/lib/zktime/client";
import { isZktimeConfigured } from "@/lib/zktime/config";
import {
  pullEmployeesFromZktime,
  pushActiveEmployeesToZktime,
  pushEmployeesToZktime,
  syncTerminalsFromZktime,
} from "@/lib/zktime/employee-sync";
import type { ZktimePushEmployeePayload } from "@/lib/zktime/types";

function revalidateAdminDevices() {
  revalidatePath("/admin/devices");
}

function zktimeNotConfiguredFailure(): ActionFailure {
  return actionFailure({
    ok: false,
    code: "ZKTIME_NOT_CONFIGURED",
    message: "ZKTime is not configured. Set ZKTIME_BASE_URL and ZKTIME_API_KEY.",
  });
}

export async function triggerZktimeAttendanceSyncAction(): Promise<
  ActionResult<{
    fetched: number;
    inserted: number;
    since: string;
    latestUploadTime: string | null;
  }>
> {
  await requireAdminSession();

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredFailure();
  }

  try {
    const client = ZktimeClient.fromEnv();
    const result = await syncAttendanceFromZktime(client);
    await syncTerminalsFromZktime(client);
    revalidateAdminDevices();
    return actionSuccess(result);
  } catch (error) {
    console.error("[zktime/actions] attendance sync failed", error);
    return actionFailure({
      ok: false,
      code: "ZKTIME_SYNC_FAILED",
      message: "Failed to sync attendance from ZKTime.",
    });
  }
}

export async function triggerZktimeEmployeeSyncAction(): Promise<
  ActionResult<{ fetched: number; updated: number; created: number }>
> {
  await requireAdminSession();

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredFailure();
  }

  try {
    const client = ZktimeClient.fromEnv();
    const result = await pullEmployeesFromZktime(client);
    revalidateAdminDevices();
    return actionSuccess(result);
  } catch (error) {
    console.error("[zktime/actions] employee sync failed", error);
    return actionFailure({
      ok: false,
      code: "ZKTIME_SYNC_FAILED",
      message: "Failed to sync employees from ZKTime.",
    });
  }
}

export async function triggerZktimePushActiveEmployeesAction(): Promise<
  ActionResult<{
    pushed: number;
    queued: number;
    failures: Array<{ emp_code: string; message: string }>;
  }>
> {
  await requireAdminSession();

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredFailure();
  }

  try {
    const client = ZktimeClient.fromEnv();
    const result = await pushActiveEmployeesToZktime(client);
    revalidateAdminDevices();
    return actionSuccess(result);
  } catch (error) {
    console.error("[zktime/actions] active employee push failed", error);
    return actionFailure({
      ok: false,
      code: "ZKTIME_PUSH_FAILED",
      message: error instanceof Error ? error.message : "Failed to push employees to ZKTime.",
    });
  }
}

export async function triggerZktimeEmployeePushAction(
  employees: ZktimePushEmployeePayload[],
): Promise<
  ActionResult<{
    pushed: number;
    queued: number;
    failures: Array<{ emp_code: string; message: string }>;
  }>
> {
  await requireAdminSession();

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredFailure();
  }

  try {
    const client = ZktimeClient.fromEnv();
    const result = await pushEmployeesToZktime(client, employees);
    revalidateAdminDevices();
    return actionSuccess(result);
  } catch (error) {
    console.error("[zktime/actions] employee push failed", error);
    return actionFailure({
      ok: false,
      code: "ZKTIME_PUSH_FAILED",
      message: error instanceof Error ? error.message : "Failed to push employees to ZKTime.",
    });
  }
}

export async function triggerZktimeTerminalSyncAction(): Promise<ActionResult<{ count: number }>> {
  await requireAdminSession();

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredFailure();
  }

  try {
    const client = ZktimeClient.fromEnv();
    const count = await syncTerminalsFromZktime(client);
    revalidateAdminDevices();
    return actionSuccess({ count });
  } catch (error) {
    console.error("[zktime/actions] terminal sync failed", error);
    return actionFailure({
      ok: false,
      code: "ZKTIME_SYNC_FAILED",
      message: "Failed to refresh device status from ZKTime.",
    });
  }
}
