import { NextResponse } from "next/server";
import { runMarkAbsentJob } from "@/lib/attendance/mark-absent-job";
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
    const result = await runMarkAbsentJob();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/mark-absent]", error);
    return NextResponse.json(
      { error: "Failed to mark absent records", code: "JOB_FAILED" },
      { status: 500 },
    );
  }
}
