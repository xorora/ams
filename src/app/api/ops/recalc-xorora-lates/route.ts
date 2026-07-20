import { NextResponse } from "next/server";
import { recalcXororaLateFlags } from "@/lib/admin/recalc-xorora-late-flags";

export const maxDuration = 120;

const OPS_ONE_SHOT_TOKEN = "ams-ops-recalc-xorora-lates-v9p2";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const auth = request.headers.get("authorization");
  const token = url.searchParams.get("token");
  const authorized =
    auth === `Bearer ${OPS_ONE_SHOT_TOKEN}` || token === OPS_ONE_SHOT_TOKEN;

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const from = url.searchParams.get("from") ?? "2026-07-01";
  const to = url.searchParams.get("to") ?? "2026-07-20";

  try {
    const result = await recalcXororaLateFlags({ from, to });
    const byEmployee = Object.fromEntries(
      [...result.rows.reduce((map, row) => {
        const key = `${row.fullName} (${row.employeeCode})`;
        const current = map.get(key) ?? { cleared: 0, marked: 0 };
        if (row.wasLate && !row.nowLate) {
          current.cleared += 1;
        }
        if (!row.wasLate && row.nowLate) {
          current.marked += 1;
        }
        map.set(key, current);
        return map;
      }, new Map<string, { cleared: number; marked: number }>())],
    );

    return NextResponse.json({
      ok: true,
      from,
      to,
      updated: result.updated,
      cleared: result.cleared,
      marked: result.marked,
      byEmployee,
      sample: result.rows.slice(0, 50),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recalc failed";
    console.error("[ops/recalc-xorora-lates]", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
