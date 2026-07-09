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
import { formatZktimeError } from "@/lib/zktime/errors";
import {
  pullEmployeesFromZktime,
  pushEmployeesToZktime,
  syncTerminalsFromZktime,
} from "@/lib/zktime/employee-sync";
import { pushAllOrganizationalDataToZktime } from "@/lib/zktime/organizational-push";
import type { OrganizationalPushResult, ZktimeEmployeeUpsertRequest } from "@/lib/zktime/types";

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
    processed: number;
    since: string;
    nextSince: string | null;
  }>
> {
  await requireAdminSession();

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredFailure();
  }

  try {
    const client = ZktimeClient.fromEnv();
    const result = await syncAttendanceFromZktime(client);
    try {
      await syncTerminalsFromZktime(client);
    } catch (terminalError) {
      console.error("[zktime/actions] terminal sync failed after attendance sync", terminalError);
    }
    revalidateAdminDevices();
    return actionSuccess(result);
  } catch (error) {
    console.error("[zktime/actions] attendance sync failed", error);
    return actionFailure({
      ok: false,
      code: "ZKTIME_SYNC_FAILED",
      message: formatZktimeError(error),
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

export async function triggerZktimeOrganizationalPushAction(): Promise<
  ActionResult<OrganizationalPushResult>
> {
  await requireAdminSession();

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredFailure();
  }

  try {
    const client = ZktimeClient.fromEnv();
    const result = await pushAllOrganizationalDataToZktime(client);
    revalidateAdminDevices();
    return actionSuccess(result);
  } catch (error) {
    console.error("[zktime/actions] organizational push failed", error);
    return actionFailure({
      ok: false,
      code: "ZKTIME_PUSH_FAILED",
      message:
        error instanceof Error ? error.message : "Failed to push organizational data to ZKTime.",
    });
  }
}

export async function triggerZktimePushActiveEmployeesAction(): Promise<
  ActionResult<OrganizationalPushResult>
> {
  return triggerZktimeOrganizationalPushAction();
}

export async function triggerZktimeEmployeePushAction(
  employees: ZktimeEmployeeUpsertRequest[],
): Promise<
  ActionResult<{
    pushed: number;
    queued: number;
    queuedForDevice: number;
    skippedUnchanged: number;
    failures: Array<{ emp_code: string; message: string }>;
    employees: Array<{
      emp_code: string;
      full_name: string;
      sync_action: "created" | "updated" | "unchanged";
      queued_for_device: boolean;
    }>;
  }>
> {
  await requireAdminSession();

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredFailure();
  }

  try {
    const client = ZktimeClient.fromEnv();
    const result = await pushEmployeesToZktime(client, {
      employees,
      queue_to_device: true,
    });
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
