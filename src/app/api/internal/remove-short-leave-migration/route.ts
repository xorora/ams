import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

function authorized(request: Request): boolean {
  const key = process.env.REMOVE_SHORT_LEAVE_MIGRATE_KEY?.trim();
  if (!key) {
    return false;
  }
  return request.headers.get("authorization") === `Bearer ${key}`;
}

/** One-shot: delete short-leave rows and drop is_short_leave. */
export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.execute(sql.raw(`
      DELETE FROM "leave_requests" WHERE "is_short_leave" = true;
    `));
    await db.execute(sql.raw(`
      ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "is_short_leave";
    `));

    const columns = await db.execute(sql.raw(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'leave_requests'
        AND column_name = 'is_short_leave'
    `));

    return NextResponse.json({
      ok: true,
      dropped: true,
      remainingShortLeaveColumnRows: columns,
    });
  } catch (error) {
    console.error("[remove-short-leave-migration]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 },
    );
  }
}
