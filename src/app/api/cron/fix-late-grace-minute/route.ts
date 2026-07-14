import { NextResponse } from "next/server";
import { fixLateGraceMinuteCheckIns } from "@/lib/admin/fix-late-grace-minute";
import {
  cronNotConfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  verifyCronAuth,
} from "@/lib/cron/auth";

/** One-shot / ops: clear is_late for check-ins in the inclusive grace minute (:15). */
export async function POST(request: Request) {
  if (!getCronSecret()) {
    return cronNotConfiguredResponse();
  }

  if (!verifyCronAuth(request)) {
    return cronUnauthorizedResponse();
  }

  try {
    const result = await fixLateGraceMinuteCheckIns();
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      rows: result.rows,
    });
  } catch (error) {
    console.error("[cron/fix-late-grace-minute]", error);
    return NextResponse.json(
      { error: "Failed to fix late grace-minute records", code: "JOB_FAILED" },
      { status: 500 },
    );
  }
}
