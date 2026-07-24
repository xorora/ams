import { sql } from "drizzle-orm";
import { db } from "@/db";

function isMissingShortLeaveSchema(error: unknown): boolean {
  const message =
    error instanceof Error
      ? `${error.message} ${error.cause instanceof Error ? error.cause.message : ""}`
      : String(error);
  return (
    message.includes("is_short_leave") ||
    (message.includes("days_count") && message.includes("numeric"))
  );
}

let ensurePromise: Promise<void> | null = null;

/** Idempotent DDL so production recovers if migration 0026 was not applied. */
export async function ensureShortLeaveSchema(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await db.execute(sql.raw(`
        ALTER TABLE "leave_requests"
          ALTER COLUMN "days_count" SET DATA TYPE numeric(4, 1);
      `));
      await db.execute(sql.raw(`
        ALTER TABLE "leave_requests"
          ADD COLUMN IF NOT EXISTS "is_short_leave" boolean DEFAULT false NOT NULL;
      `));
    })().catch((error) => {
      ensurePromise = null;
      throw error;
    });
  }

  await ensurePromise;
}

export async function withShortLeaveSchema<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingShortLeaveSchema(error)) {
      throw error;
    }
    await ensureShortLeaveSchema();
    return operation();
  }
}
