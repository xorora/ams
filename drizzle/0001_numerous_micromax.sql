ALTER TABLE "employees" ADD COLUMN "probation_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "probation_start_date" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "probation_period_months" integer DEFAULT 3 NOT NULL;