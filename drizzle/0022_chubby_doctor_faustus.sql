CREATE TYPE "public"."late_relaxation_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TABLE "late_relaxation_requests" (
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
--> statement-breakpoint
ALTER TABLE "late_relaxation_requests" ADD CONSTRAINT "late_relaxation_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "late_relaxation_requests" ADD CONSTRAINT "late_relaxation_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "late_relaxation_requests_employee_id_idx" ON "late_relaxation_requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "late_relaxation_requests_status_idx" ON "late_relaxation_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "late_relaxation_requests_year_month_idx" ON "late_relaxation_requests" USING btree ("year_month");
