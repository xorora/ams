import { EmployeesManager } from "@/components/admin/employees-manager";
import { requireAdminSession } from "@/lib/auth/require-session";

export default async function AdminEmployeesPage() {
  await requireAdminSession();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Employees</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage the employee directory. New employees can sign in with Google once their corporate
          email matches a record here.
        </p>
      </div>

      <EmployeesManager />
    </div>
  );
}
