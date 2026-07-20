import { NextResponse } from "next/server";
import { clearXororaPreAfternoonFalseLates } from "@/lib/admin/clear-xorora-pre-afternoon-lates";

export const maxDuration = 120;

/**
 * One-shot ops endpoint. Remove after use.
 * Auth: Authorization: Bearer <OPS_ONE_SHOT_TOKEN> or ?token=
 */
const OPS_ONE_SHOT_TOKEN = "ams-ops-clear-pre-afternoon-lates-r5k8";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  const token = url.searchParams.get("token");
  const authorized =
    auth === `Bearer ${OPS_ONE_SHOT_TOKEN}` || token === OPS_ONE_SHOT_TOKEN;

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const shiftDate = url.searchParams.get("shiftDate") ?? undefined;

  try {
    const result = await clearXororaPreAfternoonFalseLates(
      shiftDate ? { shiftDate } : undefined,
    );
    return NextResponse.json({
      ok: true,
      updated: result.updated,
      sample: result.rows.slice(0, 40),
      byEmployee: Object.fromEntries(
        [...result.rows.reduce((map, row) => {
          map.set(row.fullName, (map.get(row.fullName) ?? 0) + 1);
          return map;
        }, new Map<string, number>())].sort((a, b) => b[1] - a[1]),
      ),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Clear failed";
    console.error("[ops/clear-pre-afternoon-lates]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
