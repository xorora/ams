CREATE TABLE IF NOT EXISTS "salary_sheet_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"year_month" text NOT NULL,
	"file_name" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "salary_sheet_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"year_month" text NOT NULL,
	"employee_id" uuid NOT NULL,
	"salary_slip_id" uuid,
	"employee_code" text NOT NULL,
	"employee_name" text NOT NULL,
	"designation" text,
	"joining_date" text,
	"gross_salary_pkr" integer DEFAULT 0 NOT NULL,
	"basic_salary_pkr" integer DEFAULT 0 NOT NULL,
	"conveyance_allowance_pkr" integer DEFAULT 0 NOT NULL,
	"adhoc_pkr" integer DEFAULT 0 NOT NULL,
	"hr_allowance_pkr" integer DEFAULT 0 NOT NULL,
	"medical_allowance_pkr" integer DEFAULT 0 NOT NULL,
	"working_days" integer DEFAULT 0 NOT NULL,
	"days_worked" integer DEFAULT 0 NOT NULL,
	"leave_deduction_pkr" integer DEFAULT 0 NOT NULL,
	"earned_salary_pkr" integer DEFAULT 0 NOT NULL,
	"income_tax_pkr" integer DEFAULT 0 NOT NULL,
	"total_deduction_pkr" integer DEFAULT 0 NOT NULL,
	"net_salary_pkr" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "salary_sheet_imports" ADD CONSTRAINT "salary_sheet_imports_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_sheet_imports" ADD CONSTRAINT "salary_sheet_imports_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_sheet_rows" ADD CONSTRAINT "salary_sheet_rows_import_id_salary_sheet_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."salary_sheet_imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_sheet_rows" ADD CONSTRAINT "salary_sheet_rows_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_sheet_rows" ADD CONSTRAINT "salary_sheet_rows_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_sheet_rows" ADD CONSTRAINT "salary_sheet_rows_salary_slip_id_salary_slips_id_fk" FOREIGN KEY ("salary_slip_id") REFERENCES "public"."salary_slips"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "salary_sheet_imports_company_year_month_idx" ON "salary_sheet_imports" USING btree ("company_id","year_month");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "salary_sheet_rows_company_year_month_employee_idx" ON "salary_sheet_rows" USING btree ("company_id","year_month","employee_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "salary_sheet_rows_import_id_idx" ON "salary_sheet_rows" USING btree ("import_id");
