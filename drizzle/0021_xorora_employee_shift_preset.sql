ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "shift_preset" text;--> statement-breakpoint
UPDATE "employees" AS e
SET "shift_preset" = 'afternoon'
FROM "companies" AS c
WHERE e."company_id" = c."id"
  AND c."slug" = 'xorora'
  AND e."shift_preset" IS NULL;--> statement-breakpoint
UPDATE "employees" AS e
SET "shift_preset" = 'evening'
FROM "companies" AS c
WHERE e."company_id" = c."id"
  AND c."slug" = 'xorora'
  AND lower(e."full_name") IN ('daniyal zafar', 'sadia saif');
