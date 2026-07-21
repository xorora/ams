import { NextResponse } from "next/server";
import { runScheduledBreakAutoJob } from "@/lib/attendance/scheduled-break-auto";
import {
  cronNotConfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  verifyCronAuth,
} from "@/lib/cron/auth";

export async function GET(request: Request) {
  if (!getCronSecret()) {
    return cronNotConfiguredResponse();
  }

  if (!verifyCronAuth(request)) {
    return cronUnauthorizedResponse();
  }

  try {
    const result = await runScheduledBreakAutoJob();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/scheduled-breaks]", error);
    return NextResponse.json(
      { error: "Failed to auto-manage scheduled breaks", code: "JOB_FAILED" },
      { status: 500 },
    );
  }
}
