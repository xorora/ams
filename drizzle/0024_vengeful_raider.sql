ALTER TABLE "employee_compensation" ADD COLUMN "adhoc_pkr" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_compensation" ADD COLUMN "hr_allowance_pkr" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "employee_compensation" ADD COLUMN "medical_allowance_pkr" integer DEFAULT 0 NOT NULL;