import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";
import { getDatabaseUrl } from "@/lib/env";

/**
 * One-shot ops endpoint. Remove after use.
 * Auth: Authorization: Bearer <OPS_ONE_SHOT_TOKEN> or ?token=
 */
const OPS_ONE_SHOT_TOKEN = "ams-ops-shift-preset-0021-k8n3q1w6";

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
    const sql = neon(getDatabaseUrl());

    await sql`ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "shift_preset" text`;

    await sql`
      UPDATE "employees" AS e
      SET "shift_preset" = 'afternoon'
      FROM "companies" AS c
      WHERE e."company_id" = c."id"
        AND c."slug" = 'xorora'
        AND e."shift_preset" IS NULL
    `;

    await sql`
      UPDATE "employees" AS e
      SET "shift_preset" = 'evening'
      FROM "companies" AS c
      WHERE e."company_id" = c."id"
        AND c."slug" = 'xorora'
        AND lower(e."full_name") IN ('daniyal zafar', 'sadia saif')
    `;

    const rows = await sql`
      SELECT e."full_name", e."shift_preset"
      FROM "employees" AS e
      INNER JOIN "companies" AS c ON e."company_id" = c."id"
      WHERE c."slug" = 'xorora'
        AND e."is_active" = true
      ORDER BY e."full_name"
    `;

    return NextResponse.json({
      ok: true,
      migrated: true,
      xororaEmployees: rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Migration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
