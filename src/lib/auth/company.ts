import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";

export async function getCompanyIdBySlug(slug: string): Promise<string | null> {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, slug))
    .limit(1);

  return company?.id ?? null;
}

export async function getDefaultCompanyId(): Promise<string> {
  const id = await getCompanyIdBySlug("xorora");
  if (!id) {
    throw new Error("Default company is not configured.");
  }
  return id;
}
