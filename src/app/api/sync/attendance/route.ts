import { NextResponse } from "next/server";
import {
  cronNotConfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  verifyCronAuth,
  zktimeNotConfiguredResponse,
} from "@/lib/cron/auth";
import { syncAttendanceFromZktime } from "@/lib/zktime/attendance-sync";
import { ZktimeClient } from "@/lib/zktime/client";
import { isZktimeConfigured } from "@/lib/zktime/config";
import { syncTerminalsFromZktime } from "@/lib/zktime/employee-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!getCronSecret()) {
    return cronNotConfiguredResponse();
  }

  if (!verifyCronAuth(request)) {
    return cronUnauthorizedResponse();
  }

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredResponse();
  }

  try {
    const since = new URL(request.url).searchParams.get("since") ?? undefined;
    const client = ZktimeClient.fromEnv();
    const attendance = await syncAttendanceFromZktime(client, { since });
    const terminals = await syncTerminalsFromZktime(client);

    return NextResponse.json({
      ok: true,
      attendance,
      terminals,
    });
  } catch (error) {
    console.error("[sync/attendance] zktime", error);
    return NextResponse.json(
      { error: "Failed to sync attendance from ZKTime", code: "SYNC_FAILED" },
      { status: 500 },
    );
  }
}
