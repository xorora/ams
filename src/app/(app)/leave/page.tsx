import { eq } from "drizzle-orm";
import { MyLeaveManager } from "@/components/leave/my-leave-manager";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { getEmployee } from "@/lib/admin/employees-service";
import { getProbationStatusLabel } from "@/lib/admin/probation";
import { requireEmployeeSession } from "@/lib/auth/require-session";
import { canEmployeeAccessLeave } from "@/lib/leave/access";
import { getLeaveBalances, listLeaveRequests } from "@/lib/leave/leave-service";
import { serializeLeaveRequest } from "@/lib/leave/serialize";

export default async function LeavePage() {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return null;
  }

  const canAccess = await canEmployeeAccessLeave(session.user);

  if (!canAccess) {
    const employeeResult = await getEmployee(employeeId);
    const probationLabel = employeeResult.ok
      ? getProbationStatusLabel(employeeResult.data)
      : "On probation";

    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 overflow-hidden p-8">
        <div>
          <h1 className="text-2xl font-semibold">Leave</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Apply for annual, casual, and sick leave once your probation period is complete.
          </p>
        </div>

        <Alert>
          <AlertDescription>
            Leave applications are not available during your probationary period. Current status:{" "}
            <span className="font-medium">{probationLabel}</span>.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const [balancesResult, requestsResult, employeeResult] = await Promise.all([
    getLeaveBalances(employeeId),
    listLeaveRequests({ employeeId }),
    getEmployee(employeeId),
  ]);

  const balances = balancesResult.ok ? balancesResult.data : [];
  const requests = requestsResult.data.map(serializeLeaveRequest);
  const employee = employeeResult.ok ? employeeResult.data : null;
  const [company] = employee
    ? await db
        .select({ name: companies.name })
        .from(companies)
        .where(eq(companies.id, employee.companyId))
        .limit(1)
    : [];

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 overflow-hidden p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Leave</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Apply for leave and track your balance. Annual leave: 14 working days; casual leave: 10
          days (approval required); sick leave: 8 days (approval and medical certificate required).
        </p>
      </div>

      <MyLeaveManager
        balances={balances}
        requests={requests}
        companyName={company?.name ?? "Company"}
        employeeName={employee?.fullName ?? session.user.name ?? "Employee"}
        designation={employee?.designation}
        department={employee?.department}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
