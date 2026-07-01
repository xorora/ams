DROP TABLE "overtime_requests" CASCADE;--> statement-breakpoint
ALTER TABLE "attendance_days" DROP COLUMN "overtime_started_at";--> statement-breakpoint
ALTER TABLE "attendance_days" DROP COLUMN "overtime_ended_at";--> statement-breakpoint
ALTER TABLE "attendance_days" DROP COLUMN "overtime_seconds";--> statement-breakpoint
DROP TYPE "public"."overtime_request_status";