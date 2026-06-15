ALTER TYPE "public"."attendance_status" ADD VALUE IF NOT EXISTS 'weekend_off';--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "designation" text;