import { CompensationManager } from "@/components/accounting/compensation-manager";
import { maybeClearJuly2026SalaryDataOnce } from "@/lib/accounting/actions";
import { listCompensation, hasSalarySheetImport } from "@/lib/accounting/compensation-service";
import { getCurrentYearMonth } from "@/lib/accounting/format";
import { serializeCompensationListItem } from "@/lib/accounting/serialize";
import { getCompanies } from "@/lib/admin/selected-company";
import {
  requireAccountingCompanyId,
  requireAccountingOrAdminSession,
} from "@/lib/auth/require-session";

type PageProps = {
  searchParams: Promise<{ search?: string; yearMonth?: string }>;
};

function resolveYearMonth(raw: string | undefined): string {
  const value = raw?.trim() ?? "";
  if (value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return value;
  }
  return getCurrentYearMonth();
}

export default async function AdminCompensationPage({ searchParams }: PageProps) {
  const session = await requireAccountingOrAdminSession();
  const companyId = await requireAccountingCompanyId(session);
  const params = await searchParams;
  const search = params.search ?? "";
  const yearMonth = resolveYearMonth(params.yearMonth);

  await maybeClearJuly2026SalaryDataOnce();

  const [result, companiesList, sheetImported] = await Promise.all([
    listCompensation({
      companyId,
      search: search.trim() || undefined,
      yearMonth,
    }),
    getCompanies(),
    hasSalarySheetImport(companyId, yearMonth),
  ]);

  const items = result.data.map(serializeCompensationListItem);
  const companyName = companiesList.find((entry) => entry.id === companyId)?.name ?? "Company";

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Compensation</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Salary sheet for {companyName}. Upload a CNPL-format Excel file for the selected month to
          display rows and auto-generate salary slips.
        </p>
      </div>

      <CompensationManager
        items={items}
        search={search}
        yearMonth={yearMonth}
        hasSheetImport={sheetImported}
      />
    </div>
  );
}
