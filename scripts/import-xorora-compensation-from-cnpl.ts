import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename: string) {
  const path = resolve(process.cwd(), filename);
  if (!existsSync(path)) {
    return;
  }

  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]?.trim()) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile(".env.local");
  loadEnvFile(".env.vercel.production");

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      "DATABASE_URL is not set. Prefer: npx vercel env run -e production -- npx tsx scripts/import-xorora-compensation-from-cnpl.ts",
    );
  }

  const { importXororaCnplCompensation } = await import(
    "../src/lib/accounting/import-xorora-cnpl-compensation"
  );
  const result = await importXororaCnplCompensation();

  console.log(`Company: ${result.companyName}`);
  console.log(`Matched: ${result.matched.length}`);
  for (const name of result.matched) {
    console.log(`  - ${name}`);
  }
  console.log(`Unmatched: ${result.unmatched.length}`);
  for (const name of result.unmatched) {
    console.log(`  - ${name}`);
  }
  console.log(`Updated: ${result.updated}`);
  console.log(`Inserted: ${result.inserted}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
