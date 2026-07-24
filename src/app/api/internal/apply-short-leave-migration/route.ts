import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { ensureShortLeaveSchema } from "@/lib/leave/ensure-schema";

function authorized(request: Request): boolean {
  const key = process.env.SHORT_LEAVE_MIGRATE_KEY?.trim();
  if (!key) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${key}`;
}

/** One-shot production migration endpoint for short leave schema. */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await ensureShortLeaveSchema();

    const columns = await db.execute(sql.raw(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'leave_requests'
        AND column_name IN ('days_count', 'is_short_leave')
      ORDER BY column_name
    `));

    return NextResponse.json({
      ok: true,
      applied: true,
      columns,
    });
  } catch (error) {
    console.error("[apply-short-leave-migration]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Migration failed",
      },
      { status: 500 },
    );
  }
}
