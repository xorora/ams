CREATE TABLE "machine_punches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_punch_id" integer NOT NULL,
	"card_no" text NOT NULL,
	"punch_at" timestamp with time zone NOT NULL,
	"machine_no" text,
	"is_manual" boolean DEFAULT false NOT NULL,
	"machine_emp_code" text,
	"machine_emp_name" text,
	"source_emp_id" integer,
	"employee_id" uuid,
	"raw_punch_at" text,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "machine_punches_source_punch_id_unique" UNIQUE("source_punch_id")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "machine_card_no" text;--> statement-breakpoint
ALTER TABLE "machine_punches" ADD CONSTRAINT "machine_punches_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "machine_punches_punch_at_idx" ON "machine_punches" USING btree ("punch_at");--> statement-breakpoint
CREATE INDEX "machine_punches_card_no_idx" ON "machine_punches" USING btree ("card_no");--> statement-breakpoint
CREATE INDEX "machine_punches_employee_id_idx" ON "machine_punches" USING btree ("employee_id");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_machine_card_no_unique" UNIQUE("machine_card_no");