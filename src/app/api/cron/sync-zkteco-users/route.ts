import { NextResponse } from "next/server";
import { runPeriodicDeviceSync } from "@/lib/zkteco/employee-sync";

function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Cron is not configured", code: "CRON_NOT_CONFIGURED" },
      { status: 500 },
    );
  }

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runPeriodicDeviceSync();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/sync-zkteco-users]", error);
    return NextResponse.json(
      { error: "Failed to sync device users", code: "JOB_FAILED" },
      { status: 500 },
    );
  }
}
