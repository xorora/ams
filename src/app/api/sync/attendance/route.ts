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
import { isZktimeConfigured, resolveAttendanceSyncSince } from "@/lib/zktime/config";
import { syncTerminalsFromZktime } from "@/lib/zktime/employee-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function resolveSince(request: Request): Promise<string> {
  const querySince = new URL(request.url).searchParams.get("since");
  return resolveAttendanceSyncSince(querySince);
}

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
    const since = await resolveSince(request);
    const client = ZktimeClient.fromEnv();
    const attendance = await syncAttendanceFromZktime(client, { since });
    let terminals = 0;
    try {
      terminals = await syncTerminalsFromZktime(client);
    } catch (terminalError) {
      console.error("[sync/attendance] terminal sync failed after attendance sync", terminalError);
    }

    return NextResponse.json({
      source: "zktime",
      synced: attendance.fetched,
      inserted: attendance.inserted,
      processed: attendance.processed,
      since: attendance.since,
      next_since: attendance.nextSince ?? since,
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
