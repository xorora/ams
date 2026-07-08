"use server";

import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import { requireAdminSession } from "@/lib/auth/require-session";
import {
  COMPANY_COOKIE,
  resolveSelectedCompanyId,
} from "./selected-company-utils";

export type CompanyOption = {
  id: string;
  name: string;
  slug: string;
};

export const getCompanies = cache(async (): Promise<CompanyOption[]> => {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
    })
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(asc(companies.name));
});

export async function getSelectedCompanyId(): Promise<string | null> {
  const activeCompanies = await getCompanies();
  const cookieStore = await cookies();
  return resolveSelectedCompanyId(activeCompanies, cookieStore.get(COMPANY_COOKIE)?.value);
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
  revalidatePath("/admin/employees");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/leave");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/accounting/compensation");

  return actionSuccess();
}
