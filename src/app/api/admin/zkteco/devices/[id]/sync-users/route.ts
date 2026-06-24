import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin/api-response";
import { requireApiAdminSession } from "@/lib/auth/require-session";
import { type SyncDirection, triggerFullDeviceSync } from "@/lib/zkteco/employee-sync";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;

  let body: { force?: boolean; pin?: string; direction?: SyncDirection } = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as { force?: boolean; pin?: string; direction?: SyncDirection };
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, { status: 400 });
  }

  const direction = body.direction ?? "both";
  const result = await triggerFullDeviceSync(id, {
    pin: body.pin,
    force: body.force === true,
    direction,
  });

  const queued =
    result.push.queued > 0 ||
    result.pull.queued ||
    result.companyPush.queued > 0 ||
    result.companyPull.queued;

  if (!queued) {
    const reason = result.pull.reason ?? result.companyPull.reason ?? "sync_not_queued";

    return adminErrorResponse({
      ok: false,
      status: 409,
      code: "DEVICE_SYNC_NOT_QUEUED",
      message:
        reason === "device_not_found"
          ? "Device not found."
          : reason === "query_already_pending"
            ? "A sync query is already pending for this device."
            : reason === "bootstrap_already_completed" && direction === "both"
              ? 'Bootstrap already completed. Use { "force": true } to run again.'
              : "Could not queue device sync.",
    });
  }

  return NextResponse.json({ ok: true, ...result });
}
