import { NextResponse } from "next/server";
import {
  backfillShiftAttendance,
  XORORA_2026_07_09_BACKFILL,
} from "@/lib/admin/backfill-shift-attendance";
import {
  cronNotConfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  verifyCronAuth,
} from "@/lib/cron/auth";

type RouteContext = {
  params: Promise<{ shiftDate: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  if (!getCronSecret()) {
    return cronNotConfiguredResponse();
  }

  if (!verifyCronAuth(request)) {
    return cronUnauthorizedResponse();
  }

  const { shiftDate } = await context.params;
  const company = new URL(request.url).searchParams.get("company") ?? "xorora";

  if (shiftDate !== "2026-07-09") {
    return NextResponse.json(
      { error: "Only 2026-07-09 backfill is configured", code: "NOT_CONFIGURED" },
      { status: 400 },
    );
  }

  try {
    const result = await backfillShiftAttendance(company, shiftDate, XORORA_2026_07_09_BACKFILL);
    console.info("[cron/backfill-attendance]", JSON.stringify({ shiftDate, company, ...result }));
    return NextResponse.json({ ok: true, shiftDate, company, ...result });
  } catch (error) {
    console.error("[cron/backfill-attendance]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Backfill failed",
        code: "BACKFILL_FAILED",
      },
      { status: 500 },
    );
  }
}
