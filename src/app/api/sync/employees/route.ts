import { NextResponse } from "next/server";
import {
  cronNotConfiguredResponse,
  cronUnauthorizedResponse,
  verifyCronAuth,
  wdmsNotConfiguredResponse,
} from "@/lib/cron/auth";
import { WdmsClient } from "@/lib/wdms/client";
import { isWdmsConfigured } from "@/lib/wdms/config";
import { pullEmployeesFromWdms } from "@/lib/wdms/employee-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return cronNotConfiguredResponse();
  }

  if (!verifyCronAuth(request)) {
    return cronUnauthorizedResponse();
  }

  if (!isWdmsConfigured()) {
    return wdmsNotConfiguredResponse();
  }

  try {
    const client = WdmsClient.fromEnv();
    const employees = await pullEmployeesFromWdms(client);

    return NextResponse.json({
      ok: true,
      employees,
    });
  } catch (error) {
    console.error("[sync/employees]", error);
    return NextResponse.json(
      { error: "Failed to sync employees from WDMS", code: "SYNC_FAILED" },
      { status: 500 },
    );
  }
}
