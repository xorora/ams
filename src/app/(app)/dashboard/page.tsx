import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmployeeDashboard } from "@/components/attendance/employee-dashboard";
import { NewEmployeeCodeToast } from "@/components/auth/new-employee-code-toast";
import { type SerializedTodayStatus, serializeTodayStatus } from "@/lib/attendance/serialize";
import { getTodayStatus } from "@/lib/attendance/service";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";
import { needsEmployeeRegistration } from "@/lib/auth/navigation";
import { requireSession } from "@/lib/auth/require-session";

export default async function DashboardPage() {
  const session = await requireSession();

  if (needsEmployeeRegistration(session.user)) {
    redirect("/register");
  }
  const employeeId = session.user.employeeId;
  const canCheckIn = hasLinkedEmployee(session);

  let initialStatus: SerializedTodayStatus | null = null;
  const loadError: string | null = null;

  if (canCheckIn && employeeId) {
    const result = await getTodayStatus(employeeId);
    initialStatus = serializeTodayStatus(result.data);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 md:p-8">
      <Suspense fallback={null}>
        <NewEmployeeCodeToast />
      </Suspense>
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
              create an employee entry in Admin → Employees, then sign in with that employee code
              and the same email you use for AMS.
            </p>
          ) : (
            <p>
              Ask an administrator to add your employee record, then sign in on the home page with
              your employee code, email, and password.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
