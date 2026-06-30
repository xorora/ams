DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'device_terminals'
  ) THEN
    NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'wdms_terminals'
  ) THEN
    ALTER TABLE "wdms_terminals" RENAME TO "device_terminals";
    ALTER INDEX IF EXISTS "wdms_terminals_serial_number_unique" RENAME TO "device_terminals_serial_number_unique";
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'zkteco_devices'
  ) THEN
    ALTER TABLE "zkteco_devices" RENAME TO "device_terminals";
    ALTER TABLE "device_terminals" DROP COLUMN IF EXISTS "push_version";
    ALTER INDEX IF EXISTS "zkteco_devices_serial_number_unique" RENAME TO "device_terminals_serial_number_unique";
  ELSE
    CREATE TABLE "device_terminals" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "serial_number" text NOT NULL,
      "alias" text,
      "ip_address" text,
      "firmware_version" text,
      "last_seen_at" timestamp with time zone,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      CONSTRAINT "device_terminals_serial_number_unique" UNIQUE("serial_number")
    );
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "machine_punches" ALTER COLUMN "source_system" SET DEFAULT 'zkteco';
