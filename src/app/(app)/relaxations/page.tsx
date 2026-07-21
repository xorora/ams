import { MyLateRelaxationManager } from "@/components/late-relaxation/my-late-relaxation-manager";
import { getEmployeeMonthlyLateSummary } from "@/lib/attendance/late-fines";
import { requireEmployeeSession } from "@/lib/auth/require-session";
import {
  getCurrentYearMonth,
  listLateRelaxationRequests,
} from "@/lib/late-relaxation/late-relaxation-service";
import { serializeLateRelaxationRequest } from "@/lib/late-relaxation/serialize";

export default async function RelaxationsPage() {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return null;
  }

  const yearMonth = getCurrentYearMonth();
  const [summary, requestsResult] = await Promise.all([
    getEmployeeMonthlyLateSummary(employeeId, `${yearMonth}-01`),
    listLateRelaxationRequests({ employeeId }),
  ]);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Late relaxations</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          After more than 3 late check-ins in a month, request a fine waiver. If approved, no late
          fine is charged for that month.
        </p>
      </div>

      <MyLateRelaxationManager
        yearMonth={yearMonth}
        summary={summary}
        requests={requestsResult.data.map(serializeLateRelaxationRequest)}
        className="md:min-h-0 md:flex-1"
      />
    </div>
  );
}
