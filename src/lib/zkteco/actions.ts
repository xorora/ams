"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { zktecoDevices } from "@/db/schema";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import { requireAdminSession } from "@/lib/auth/require-session";
import {
  countPendingCommands,
  type DeviceConnectionStatus,
  formatDeviceLastSeen,
  getDeviceConnectionStatus,
  getSecondsSinceLastSeen,
  requeueStaleSentCommands,
} from "@/lib/zkteco/device-service";
import {
  type DeviceSyncSummary,
  type SyncDirection,
  summarizeDeviceSync,
  triggerFullDeviceSync,
} from "@/lib/zkteco/employee-sync";

function revalidateAdminDevices() {
  revalidatePath("/admin/devices");
}

export async function triggerZktecoDeviceSyncAction(
  deviceId: string,
  options: { direction?: SyncDirection; force?: boolean } = {},
): Promise<ActionResult<DeviceSyncSummary>> {
  await requireAdminSession();

  const direction = options.direction ?? "sync";
  const result = await triggerFullDeviceSync(deviceId, { ...options, direction });
  const summary = summarizeDeviceSync(result);
  const queued = summary.totalCommands > 0;

  if (!queued) {
    const reason = result.pull.reason ?? result.companyPull.reason ?? "sync_not_queued";

    return actionFailure({
      ok: false,
      code: "DEVICE_SYNC_NOT_QUEUED",
      message:
        reason === "device_not_found"
          ? "Device not found."
          : reason === "query_already_pending"
            ? "A sync query is already pending for this device."
            : reason === "bootstrap_already_completed" && direction === "both"
              ? "Bootstrap already completed. Use Sync to run again."
              : "Could not queue device sync. Is the device online?",
    });
  }

  revalidateAdminDevices();
  return actionSuccess(summary);
}

export type DeviceStatusSnapshot = {
  connectionStatus: DeviceConnectionStatus;
  secondsSinceLastSeen: number | null;
  lastSeenAt: string | null;
  lastSeenLabel: string;
  ipAddress: string | null;
  pendingCommands: number;
  requeuedCommands: number;
};

export async function refreshZktecoDeviceStatusAction(
  deviceId: string,
): Promise<ActionResult<DeviceStatusSnapshot>> {
  await requireAdminSession();

  const device = await db.query.zktecoDevices.findFirst({
    where: eq(zktecoDevices.id, deviceId),
  });

  if (!device) {
    return actionFailure({
      ok: false,
      code: "DEVICE_NOT_FOUND",
      message: "Device not found.",
    });
  }

  const requeued = await requeueStaleSentCommands(deviceId);
  const pending = await countPendingCommands(deviceId);

  const snapshot: DeviceStatusSnapshot = {
    connectionStatus: getDeviceConnectionStatus(device.lastSeenAt),
    secondsSinceLastSeen: getSecondsSinceLastSeen(device.lastSeenAt),
    lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    lastSeenLabel: formatDeviceLastSeen(device.lastSeenAt),
    ipAddress: device.ipAddress,
    pendingCommands: pending,
    requeuedCommands: requeued,
  };

  revalidateAdminDevices();
  return actionSuccess(snapshot);
}
