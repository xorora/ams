import { AccountingAdminsManager } from "@/components/accounting/accounting-admins-manager";
import { listAssignments } from "@/lib/accounting/assignments-service";
import { serializeAssignment } from "@/lib/accounting/serialize";
import { getCompanies } from "@/lib/admin/selected-company";
import { requireAdminSession } from "@/lib/auth/require-session";

export default async function AdminAccountingAdminsPage() {
  await requireAdminSession();

  const [assignmentsResult, companies] = await Promise.all([listAssignments(), getCompanies()]);

  const assignments = assignmentsResult.data.map(serializeAssignment);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-6 p-4 md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Accounting admins</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Assign existing users as accounting admins for a company. They can manage compensation
          profiles and salary slips for their assigned company only.
        </p>
      </div>

      <AccountingAdminsManager assignments={assignments} companies={companies} />
    </div>
  );
}
