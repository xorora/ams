ALTER TABLE "attendance_days" ADD COLUMN "overtime_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_days" ADD COLUMN "overtime_ended_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "attendance_days" ADD COLUMN "overtime_seconds" integer;