import { NextResponse } from "next/server";
import {
  cronNotConfiguredResponse,
  cronUnauthorizedResponse,
  deviceSyncNotConfiguredResponse,
  getCronSecret,
  verifyCronAuth,
} from "@/lib/cron/auth";
import { getDeviceSyncProvider } from "@/lib/device-sync/provider";
import { syncAttendanceFromWdms } from "@/lib/wdms/attendance-sync";
import { WdmsClient } from "@/lib/wdms/client";
import { syncTerminalsFromWdms } from "@/lib/wdms/employee-sync";
import { syncAttendanceFromZktime } from "@/lib/zktime/attendance-sync";
import { ZktimeClient } from "@/lib/zktime/client";
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

  const provider = getDeviceSyncProvider();
  if (!provider) {
    return deviceSyncNotConfiguredResponse();
  }

  try {
    if (provider === "zktime") {
      const since = new URL(request.url).searchParams.get("since") ?? undefined;
      const client = ZktimeClient.fromEnv();
      const attendance = await syncAttendanceFromZktime(client, { since });
      const terminals = await syncTerminalsFromZktime(client);

      return NextResponse.json({
        ok: true,
        attendance,
        terminals,
      });
    }

    const client = WdmsClient.fromEnv();
    const attendance = await syncAttendanceFromWdms(client);
    const terminals = await syncTerminalsFromWdms(client);

    return NextResponse.json({
      ok: true,
      attendance: {
        ...attendance,
        latestUploadTime: attendance.latest,
      },
      terminals,
    });
  } catch (error) {
    if (provider === "zktime") {
      console.error("[sync/attendance] zktime", error);
      return NextResponse.json(
        { error: "Failed to sync attendance from ZKTime", code: "SYNC_FAILED" },
        { status: 500 },
      );
    }

    console.error("[sync/attendance] wdms", error);
    return NextResponse.json(
      { error: "Failed to sync attendance from WDMS", code: "SYNC_FAILED" },
      { status: 500 },
    );
  }
}
