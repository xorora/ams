ALTER TYPE "public"."machine_punch_source" ADD VALUE IF NOT EXISTS 'wdms';--> statement-breakpoint
ALTER TABLE "machine_punches" ALTER COLUMN "source_system" SET DEFAULT 'wdms';--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'zkteco_devices'
  ) THEN
    ALTER TABLE "zkteco_devices" RENAME TO "wdms_terminals";
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "wdms_terminals" DROP COLUMN IF EXISTS "push_version";--> statement-breakpoint
DROP TABLE IF EXISTS "zkteco_device_commands";--> statement-breakpoint
DROP TABLE IF EXISTS "biometric_employee_mappings";--> statement-breakpoint
DROP TYPE IF EXISTS "public"."zkteco_command_status";--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN IF EXISTS "machine_card_no";
