import { NextResponse } from "next/server";
import { repairCrestLedAttendanceDay } from "@/lib/admin/repair-crest-led-day";

export const maxDuration = 300;

/**
 * One-shot ops endpoint. Remove after use.
 * Auth: Authorization: Bearer <OPS_ONE_SHOT_TOKEN> or ?token=
 */
const OPS_ONE_SHOT_TOKEN = "ams-ops-crest-jul18-repair-q7n2w8";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  const token = url.searchParams.get("token");
  const authorized =
    auth === `Bearer ${OPS_ONE_SHOT_TOKEN}` || token === OPS_ONE_SHOT_TOKEN;

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shiftDate = url.searchParams.get("shiftDate") ?? "2026-07-18";

  try {
    const result = await repairCrestLedAttendanceDay(shiftDate);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Repair failed";
    console.error("[ops/repair-crest-led-day]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
