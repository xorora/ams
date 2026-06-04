import { EmployeeDashboard } from "@/components/attendance/employee-dashboard";
import { type SerializedTodayStatus, serializeTodayStatus } from "@/lib/attendance/serialize";
import { getTodayStatus } from "@/lib/attendance/service";
import { requireSession } from "@/lib/auth/require-session";

export default async function DashboardPage() {
  const session = await requireSession();
  const employeeId = session.user.employeeId;
  const isEmployee = session.user.role === "employee" && employeeId;

  let initialStatus: SerializedTodayStatus | null = null;
  const loadError: string | null = null;

  if (isEmployee && employeeId) {
    const result = await getTodayStatus(employeeId);
    initialStatus = serializeTodayStatus(result.data);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {isEmployee
            ? "Check in, take breaks, and check out for your shift."
            : session.user.role === "admin"
              ? "Employee check-in is available when your account is linked to an employee record."
              : "Your account is not linked to an employee record yet."}
        </p>
      </div>

      {isEmployee ? (
        <EmployeeDashboard initialStatus={initialStatus} loadError={loadError} />
      ) : (
        <div className="rounded-xl border bg-muted/40 p-5 text-sm">
          {session.user.role === "admin" ? (
            <p>
              Use the admin section in the sidebar for employee and attendance management. To use
              check-in here, ask another administrator to link your corporate email to an employee
              record.
            </p>
          ) : (
            <p>
              Ask an administrator to add your corporate email in the employee directory, then sign
              in again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
