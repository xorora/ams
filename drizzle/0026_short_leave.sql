ALTER TABLE "leave_requests" ALTER COLUMN "days_count" SET DATA TYPE numeric(4, 1);--> statement-breakpoint
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "is_short_leave" boolean DEFAULT false NOT NULL;
