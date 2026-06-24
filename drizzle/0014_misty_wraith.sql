CREATE TYPE "public"."machine_punch_source" AS ENUM('ebio', 'zkteco');--> statement-breakpoint
CREATE TYPE "public"."zkteco_command_status" AS ENUM('pending', 'sent', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "sync_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zkteco_device_commands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"command_text" text NOT NULL,
	"status" "zkteco_command_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"result_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zkteco_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial_number" text NOT NULL,
	"alias" text,
	"ip_address" text,
	"firmware_version" text,
	"push_version" text,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "zkteco_devices_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
ALTER TABLE "machine_punches" DROP CONSTRAINT "machine_punches_source_punch_id_unique";--> statement-breakpoint
ALTER TABLE "biometric_employee_mappings" ALTER COLUMN "source_emp_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "biometric_employee_mappings" ADD COLUMN "device_pin" text;--> statement-breakpoint
ALTER TABLE "biometric_employee_mappings" ADD COLUMN "zkteco_device_id" uuid;--> statement-breakpoint
ALTER TABLE "machine_punches" ADD COLUMN "source_system" "machine_punch_source";--> statement-breakpoint
UPDATE "machine_punches" SET "source_system" = 'ebio' WHERE "source_system" IS NULL;--> statement-breakpoint
ALTER TABLE "machine_punches" ALTER COLUMN "source_system" SET DEFAULT 'zkteco';--> statement-breakpoint
ALTER TABLE "machine_punches" ALTER COLUMN "source_system" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "zkteco_device_commands" ADD CONSTRAINT "zkteco_device_commands_device_id_zkteco_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."zkteco_devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "zkteco_device_commands_device_status_idx" ON "zkteco_device_commands" USING btree ("device_id","status");--> statement-breakpoint
CREATE INDEX "zkteco_device_commands_created_at_idx" ON "zkteco_device_commands" USING btree ("created_at");--> statement-breakpoint
ALTER TABLE "biometric_employee_mappings" ADD CONSTRAINT "biometric_employee_mappings_zkteco_device_id_zkteco_devices_id_fk" FOREIGN KEY ("zkteco_device_id") REFERENCES "public"."zkteco_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "machine_punches_source_system_punch_id_idx" ON "machine_punches" USING btree ("source_system","source_punch_id");--> statement-breakpoint
ALTER TABLE "biometric_employee_mappings" ADD CONSTRAINT "biometric_employee_mappings_device_pin_unique" UNIQUE("device_pin");