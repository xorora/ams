DELETE FROM "machine_punches" AS a
USING "machine_punches" AS b
WHERE a."card_no" = b."card_no"
  AND a."punch_at" = b."punch_at"
  AND a."id" > b."id";--> statement-breakpoint
CREATE UNIQUE INDEX "machine_punches_card_no_punch_at_idx" ON "machine_punches" ("card_no", "punch_at");
