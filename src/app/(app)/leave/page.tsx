import { eq } from "drizzle-orm";
import { MyLeaveManager } from "@/components/leave/my-leave-manager";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { getEmployee } from "@/lib/admin/employees-service";
import { getProbationStatusLabel, isCurrentlyOnProbation } from "@/lib/admin/probation";
import { requireEmployeeSession } from "@/lib/auth/require-session";
import { canEmployeeAccessLeave } from "@/lib/leave/access";
import {
  getLeaveBalances,
  getUnpaidLeaveSummary,
  listLeaveRequests,
} from "@/lib/leave/leave-service";
import { serializeLeaveRequest } from "@/lib/leave/serialize";
import type { UnpaidLeaveSummary } from "@/lib/leave/types";

export default async function LeavePage() {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return null;
  }

  const canApply = await canEmployeeAccessLeave(session.user);

  const [employeeResult, requestsResult] = await Promise.all([
    getEmployee(employeeId),
    listLeaveRequests({ employeeId }),
  ]);

  const employee = employeeResult.ok ? employeeResult.data : null;
  const probationUnpaidOnly = employee ? isCurrentlyOnProbation(employee) : false;

  const [balancesResult, unpaidSummaryResult] = await Promise.all([
    canApply && !probationUnpaidOnly
      ? getLeaveBalances(employeeId)
      : Promise.resolve({ ok: true as const, data: [] }),
    probationUnpaidOnly && canApply
      ? getUnpaidLeaveSummary(employeeId)
      : Promise.resolve({ ok: true as const, data: { used: 0, pending: 0, total: 0 } }),
  ]);

  const balances = balancesResult.ok ? balancesResult.data : [];
  const unpaidSummary: UnpaidLeaveSummary = unpaidSummaryResult.ok
    ? unpaidSummaryResult.data
    : { used: 0, pending: 0, total: 0 };
  const requests = requestsResult.data.map(serializeLeaveRequest);
  const probationLabel = employee ? getProbationStatusLabel(employee) : "On probation";
  const [company] = employee
    ? await db
        .select({ name: companies.name, slug: companies.slug })
        .from(companies)
        .where(eq(companies.id, employee.companyId))
        .limit(1)
    : [];

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Leave</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          {probationUnpaidOnly
            ? "You are on probation. Apply for emergency unpaid leave when needed; HR approval is required. Entitled leave becomes available after probation."
            : canApply
              ? "Apply for leave and track your balance. Annual leave: 14 working days; casual leave: 10 days (approval required); sick leave: 8 days (approval and medical certificate required)."
              : "Track your leave request statuses."}
        </p>
      </div>

      {probationUnpaidOnly ? (
        <Alert>
          <AlertDescription>
            Entitled leave is not available during probation. You can request emergency unpaid
            leave, subject to HR approval. Current status:&nbsp;
            <span className="font-medium">{probationLabel}</span>.
          </AlertDescription>
        </Alert>
      ) : null}

      <MyLeaveManager
        balances={balances}
        requests={requests}
        companyName={company?.name ?? "Company"}
        companySlug={company?.slug ?? "xorora"}
        employeeName={employee?.fullName ?? session.user.name ?? "Employee"}
        designation={employee?.designation}
        department={employee?.department}
        canApply={canApply}
        probationUnpaidOnly={probationUnpaidOnly}
        unpaidSummary={unpaidSummary}
        className="md:min-h-0 md:flex-1"
      />
    </div>
  );
}
