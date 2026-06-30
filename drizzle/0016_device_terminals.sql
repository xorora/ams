ALTER TABLE "wdms_terminals" RENAME TO "device_terminals";--> statement-breakpoint
ALTER TABLE "machine_punches" ALTER COLUMN "source_system" SET DEFAULT 'zkteco';
