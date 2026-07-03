import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { getDefaultCompanySlug } from "@/lib/zktime/config";

export type CompanyRecord = {
  id: string;
  name: string;
  slug: string;
};

function normalizeCompanyKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
}

export function parseZktimeDepartmentLabel(deptName: string | null | undefined): {
  companyPrefix: string | null;
  department: string | null;
} {
  const trimmed = deptName?.trim();
  if (!trimmed) {
    return { companyPrefix: null, department: null };
  }

  const separator = trimmed.indexOf(" - ");
  if (separator === -1) {
    return { companyPrefix: null, department: trimmed };
  }

  const companyPrefix = trimmed.slice(0, separator).trim();
  const department = trimmed.slice(separator + 3).trim();

  return {
    companyPrefix: companyPrefix || null,
    department: department || null,
  };
}

export function resolveCompanyFromDepartmentLabel(
  deptName: string | null | undefined,
  activeCompanies: CompanyRecord[],
  fallbackCompanyId: string,
): CompanyRecord {
  const { companyPrefix } = parseZktimeDepartmentLabel(deptName);
  if (!companyPrefix) {
    return (
      activeCompanies.find((company) => company.id === fallbackCompanyId) ??
      activeCompanies[0] ?? {
        id: fallbackCompanyId,
        name: "Company",
        slug: getDefaultCompanySlug(),
      }
    );
  }

  const normalizedPrefix = normalizeCompanyKey(companyPrefix);

  for (const company of activeCompanies) {
    if (normalizeCompanyKey(company.name) === normalizedPrefix) {
      return company;
    }
    if (normalizeCompanyKey(company.slug) === normalizedPrefix) {
      return company;
    }
    if (normalizeCompanyKey(company.slug.replace(/-/g, " ")) === normalizedPrefix) {
      return company;
    }
  }

  if (normalizedPrefix.includes("crest")) {
    const crest = activeCompanies.find((company) => company.slug === "crest-led");
    if (crest) {
      return crest;
    }
  }

  if (normalizedPrefix.includes("xorora")) {
    const xorora = activeCompanies.find((company) => company.slug === "xorora");
    if (xorora) {
      return xorora;
    }
  }

  return (
    activeCompanies.find((company) => company.id === fallbackCompanyId) ??
    activeCompanies[0] ?? {
      id: fallbackCompanyId,
      name: "Company",
      slug: getDefaultCompanySlug(),
    }
  );
}

export async function loadActiveCompanies(): Promise<CompanyRecord[]> {
  return db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
    })
    .from(companies)
    .where(eq(companies.isActive, true));
}

export function emailDomainForCompanySlug(slug: string): string {
  if (slug === "crest-led") {
    return "crestled.com";
  }
  if (slug === "xorora") {
    return "xorora.com";
  }
  return `${slug.replace(/-/g, "")}.com`;
}
