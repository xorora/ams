"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import { requireAdminSession } from "@/lib/auth/require-session";
import { type SyncDirection, triggerFullDeviceSync } from "@/lib/zkteco/employee-sync";

function revalidateAdminDevices() {
  revalidatePath("/admin/devices");
}

export async function triggerZktecoDeviceSyncAction(
  deviceId: string,
  options: { direction?: SyncDirection; force?: boolean } = {},
): Promise<ActionResult> {
  await requireAdminSession();

  const result = await triggerFullDeviceSync(deviceId, options);
  const queued =
    result.push.queued > 0 ||
    result.pull.queued ||
    result.companyPush.queued > 0 ||
    result.companyPull.queued;

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
            : reason === "bootstrap_already_completed" && (options.direction ?? "both") === "both"
              ? "Bootstrap already completed. Use force sync to run again."
              : "Could not queue device sync.",
    });
  }

  revalidateAdminDevices();
  return actionSuccess();
}
