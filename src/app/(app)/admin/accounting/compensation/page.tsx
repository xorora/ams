import { CompensationManager } from "@/components/accounting/compensation-manager";
import { listCompensation } from "@/lib/accounting/compensation-service";
import { serializeCompensationListItem } from "@/lib/accounting/serialize";
import { getCompanies } from "@/lib/admin/selected-company";
import {
  requireAccountingCompanyId,
  requireAccountingOrAdminSession,
} from "@/lib/auth/require-session";

type PageProps = {
  searchParams: Promise<{ search?: string }>;
};

export default async function AdminCompensationPage({ searchParams }: PageProps) {
  const session = await requireAccountingOrAdminSession();
  const companyId = await requireAccountingCompanyId(session);
  const params = await searchParams;
  const search = params.search ?? "";

  const [result, companies] = await Promise.all([
    listCompensation({ companyId, search: search.trim() || undefined }),
    getCompanies(),
  ]);

  const items = result.data.map(serializeCompensationListItem);
  const companyName = companies.find((company) => company.id === companyId)?.name ?? "Company";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Compensation</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Set gross salary, bank details, and fixed monthly adjustments for employees at{" "}
          {companyName}.
        </p>
      </div>

      <CompensationManager items={items} search={search} />
    </div>
  );
}
