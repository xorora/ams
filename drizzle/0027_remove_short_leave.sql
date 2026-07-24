-- Remove short leave feature: delete half-day rows, then drop the flag column.
DELETE FROM "leave_requests" WHERE "is_short_leave" = true;--> statement-breakpoint
ALTER TABLE "leave_requests" DROP COLUMN IF EXISTS "is_short_leave";
