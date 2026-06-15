"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import { requireAdminSession } from "@/lib/auth/require-session";

const COMPANY_COOKIE = "ams_company";

export type CompanyOption = {
  id: string;
  name: string;
  slug: string;
};

export async function getCompanies(): Promise<CompanyOption[]> {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
    })
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(asc(companies.name));
}

export async function getSelectedCompanyId(): Promise<string | null> {
  const activeCompanies = await getCompanies();
  if (activeCompanies.length === 0) {
    return null;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(COMPANY_COOKIE)?.value;

  if (cookieValue && activeCompanies.some((company) => company.id === cookieValue)) {
    return cookieValue;
  }

  return activeCompanies[0]?.id ?? null;
}

export async function requireSelectedCompanyId(): Promise<string> {
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    throw new Error("No active company is configured.");
  }
  return companyId;
}

export async function setSelectedCompany(companyId: string): Promise<ActionResult> {
  await requireAdminSession();

  const activeCompanies = await getCompanies();
  if (!activeCompanies.some((company) => company.id === companyId)) {
    return actionFailure({
      ok: false,
      message: "Invalid company.",
      code: "INVALID_COMPANY",
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(COMPANY_COOKIE, companyId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });

  revalidatePath("/", "layout");

  return actionSuccess();
}
