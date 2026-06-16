CREATE TABLE "biometric_employee_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_emp_id" integer NOT NULL,
	"card_no" text NOT NULL,
	"machine_emp_code" text,
	"machine_emp_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"match_method" text NOT NULL,
	"match_score" real,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "biometric_employee_mappings_source_emp_id_unique" UNIQUE("source_emp_id"),
	CONSTRAINT "biometric_employee_mappings_card_no_unique" UNIQUE("card_no")
);
--> statement-breakpoint
ALTER TABLE "biometric_employee_mappings" ADD CONSTRAINT "biometric_employee_mappings_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;