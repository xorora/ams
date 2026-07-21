import { sql } from "drizzle-orm";
import { db } from "@/db";

function isMissingLateRelaxationRelation(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`
      : String(error);
  return message.includes("late_relaxation_requests") && message.includes("does not exist");
}

let ensurePromise: Promise<void> | null = null;

/** Idempotent DDL so production recovers if migration 0022 was not applied. */
export async function ensureLateRelaxationSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await db.execute(sql.raw(`
        DO $$ BEGIN
          CREATE TYPE "public"."late_relaxation_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `));

      await db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS "late_relaxation_requests" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
          "employee_id" uuid NOT NULL,
          "year_month" text NOT NULL,
          "reason" text NOT NULL,
          "late_count_at_request" integer NOT NULL,
          "status" "late_relaxation_status" DEFAULT 'pending' NOT NULL,
          "reviewed_by_user_id" uuid,
          "reviewed_at" timestamp with time zone,
          "review_notes" text,
          "created_at" timestamp with time zone DEFAULT now() NOT NULL,
          "updated_at" timestamp with time zone DEFAULT now() NOT NULL
        );
      `));

      await db.execute(sql.raw(`
        DO $$ BEGIN
          ALTER TABLE "late_relaxation_requests"
            ADD CONSTRAINT "late_relaxation_requests_employee_id_employees_id_fk"
            FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id")
            ON DELETE no action ON UPDATE no action;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `));

      await db.execute(sql.raw(`
        DO $$ BEGIN
          ALTER TABLE "late_relaxation_requests"
            ADD CONSTRAINT "late_relaxation_requests_reviewed_by_user_id_users_id_fk"
            FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id")
            ON DELETE no action ON UPDATE no action;
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `));

      await db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS "late_relaxation_requests_employee_id_idx"
          ON "late_relaxation_requests" USING btree ("employee_id");
      `));
      await db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS "late_relaxation_requests_status_idx"
          ON "late_relaxation_requests" USING btree ("status");
      `));
      await db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS "late_relaxation_requests_year_month_idx"
          ON "late_relaxation_requests" USING btree ("year_month");
      `));
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  await ensurePromise;
}

export async function withLateRelaxationSchema<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingLateRelaxationRelation(error)) {
      throw error;
    }
    await ensureLateRelaxationSchema();
    return operation();
  }
}
