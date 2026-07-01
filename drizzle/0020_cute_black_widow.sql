ALTER TYPE "public"."user_role" ADD VALUE 'accounting_admin';--> statement-breakpoint
CREATE TABLE "employee_compensation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"gross_salary_pkr" integer NOT NULL,
	"bank_name" text,
	"bank_account_number" text,
	"fixed_security_deduction_pkr" integer DEFAULT 0 NOT NULL,
	"fixed_other_pay_pkr" integer DEFAULT 0 NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "salary_slips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"year_month" text NOT NULL,
	"income_tax_pkr" integer DEFAULT 0 NOT NULL,
	"additional_deduction_pkr" integer DEFAULT 0 NOT NULL,
	"deduction_details" text,
	"other_pay_pkr" integer DEFAULT 0 NOT NULL,
	"increment_pkr" integer DEFAULT 0 NOT NULL,
	"other_payable_details" text,
	"total_days" integer NOT NULL,
	"earned_days" integer NOT NULL,
	"deduct_days" integer NOT NULL,
	"calculated_salary_pkr" integer NOT NULL,
	"auto_leave_deduction_pkr" integer NOT NULL,
	"security_deduction_pkr" integer NOT NULL,
	"total_other_pay_pkr" integer NOT NULL,
	"total_deduction_pkr" integer NOT NULL,
	"net_salary_pkr" integer NOT NULL,
	"transfer_details" text,
	"created_by_user_id" uuid NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_company_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"company_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employee_compensation" ADD CONSTRAINT "employee_compensation_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_compensation" ADD CONSTRAINT "employee_compensation_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_assignments" ADD CONSTRAINT "user_company_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_company_assignments" ADD CONSTRAINT "user_company_assignments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "employee_compensation_employee_id_idx" ON "employee_compensation" USING btree ("employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "salary_slips_employee_year_month_idx" ON "salary_slips" USING btree ("employee_id","year_month");--> statement-breakpoint
CREATE INDEX "salary_slips_company_year_month_idx" ON "salary_slips" USING btree ("company_id","year_month");--> statement-breakpoint
CREATE UNIQUE INDEX "user_company_assignments_user_id_idx" ON "user_company_assignments" USING btree ("user_id");