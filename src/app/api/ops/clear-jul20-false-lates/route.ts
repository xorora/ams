import { NextResponse } from "next/server";
import { clearXororaPreAfternoonFalseLates } from "@/lib/admin/clear-xorora-pre-afternoon-lates";

/**
 * One-shot ops endpoint. Remove after use.
 * Auth: Authorization: Bearer <OPS_ONE_SHOT_TOKEN> or ?token=
 */
const OPS_ONE_SHOT_TOKEN = "ams-ops-jul20-evening-lates-m4p9x2";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  const token = url.searchParams.get("token");
  const authorized =
    auth === `Bearer ${OPS_ONE_SHOT_TOKEN}` || token === OPS_ONE_SHOT_TOKEN;

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await clearXororaPreAfternoonFalseLates({
      shiftDate: "2026-07-20",
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fix failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
