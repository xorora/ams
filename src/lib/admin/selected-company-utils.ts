import { getDefaultCompanySlug } from "@/lib/zktime/config";

export const COMPANY_COOKIE = "ams_company";

type CompanyOption = {
  id: string;
  name: string;
  slug: string;
};

export function resolveSelectedCompanyId(
  activeCompanies: CompanyOption[],
  cookieValue: string | undefined,
): string | null {
  if (activeCompanies.length === 0) {
    return null;
  }

  if (cookieValue && activeCompanies.some((company) => company.id === cookieValue)) {
    return cookieValue;
  }

  const preferredSlug = getDefaultCompanySlug();
  const preferredCompany = activeCompanies.find((company) => company.slug === preferredSlug);

  return preferredCompany?.id ?? activeCompanies[0]?.id ?? null;
}
