import { MyOvertimeManager } from "@/components/overtime/my-overtime-manager";
import { getEmployee } from "@/lib/admin/employees-service";
import { requireEmployeeSession } from "@/lib/auth/require-session";
import { MIN_OVERTIME_REQUEST_SECONDS } from "@/lib/overtime/constants";
import {
  listEligibleOvertimeDays,
  listOvertimeRequests,
} from "@/lib/overtime/overtime-request-service";
import { serializeEligibleOvertimeDay, serializeOvertimeRequest } from "@/lib/overtime/serialize";

export default async function OvertimePage() {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;

  if (!employeeId) {
    return null;
  }

  const [employeeResult, eligibleResult, requestsResult] = await Promise.all([
    getEmployee(employeeId),
    listEligibleOvertimeDays(employeeId),
    listOvertimeRequests({ employeeId }),
  ]);

  const employee = employeeResult.ok ? employeeResult.data : null;
  const eligibleDays = eligibleResult.data.map(serializeEligibleOvertimeDay);
  const requests = requestsResult.data.map(serializeOvertimeRequest);
  const minimumHours = MIN_OVERTIME_REQUEST_SECONDS / 3600;

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Overtime</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Apply for overtime on days where at least {minimumHours} hours were tracked after your
          shift. Fill in the work description and submit for approval.
        </p>
      </div>

      <MyOvertimeManager
        eligibleDays={eligibleDays}
        requests={requests}
        employeeName={employee?.fullName ?? session.user.name ?? "Employee"}
        designation={employee?.designation}
        className="md:min-h-0 md:flex-1"
      />
    </div>
  );
}
