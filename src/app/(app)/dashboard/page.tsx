import { EmployeeDashboard } from "@/components/attendance/employee-dashboard";
import { type SerializedTodayStatus, serializeTodayStatus } from "@/lib/attendance/serialize";
import { getTodayStatus } from "@/lib/attendance/service";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";
import { requireSession } from "@/lib/auth/require-session";

export default async function DashboardPage() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  const canCheckIn = hasLinkedEmployee(session);

  let initialStatus: SerializedTodayStatus | null = null;
  const loadError: string | null = null;

  if (canCheckIn && employeeId) {
    const result = await getTodayStatus(employeeId);
    initialStatus = serializeTodayStatus(result.data);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {canCheckIn
            ? "Check in, take breaks, and check out for your shift."
            : session.user.role === "admin"
              ? "Add an employee record with your corporate email under Admin → Employees to enable check-in here."
              : "Your account is not linked to an employee record yet."}
        </p>
      </div>

      {canCheckIn ? (
        <EmployeeDashboard initialStatus={initialStatus} loadError={loadError} />
      ) : (
        <div className="rounded-xl border bg-muted/40 p-5 text-sm">
          {session.user.role === "admin" ? (
            <p>
              Use the admin section in the sidebar for team attendance. To check in for yourself,
              create an employee entry in Admin → Employees using the same email as your Google
              account, then refresh this page.
            </p>
          ) : (
            <p>
              Ask an administrator to add your corporate email in the employee directory, then
              refresh this page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
