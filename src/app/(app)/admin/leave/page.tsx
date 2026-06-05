import { LeaveManager } from "@/components/leave/leave-manager";
import { listEmployees } from "@/lib/admin/employees-service";
import { serializeEmployee } from "@/lib/admin/serialize";
import { requireAdminSession } from "@/lib/auth/require-session";
import { listLeaveRequests } from "@/lib/leave/leave-service";
import { serializeLeaveRequest } from "@/lib/leave/serialize";
import type { LeaveRequestStatus, LeaveType } from "@/lib/leave/types";

type PageProps = {
  searchParams: Promise<{
    status?: string;
    leaveType?: string;
    employeeId?: string;
  }>;
};

export default async function AdminLeavePage({ searchParams }: PageProps) {
  await requireAdminSession();
  const params = await searchParams;

  const statusParam = params.status;
  const leaveTypeParam = params.leaveType;

  const filters = {
    status:
      statusParam === "pending" ||
      statusParam === "approved" ||
      statusParam === "rejected" ||
      statusParam === "cancelled"
        ? (statusParam as LeaveRequestStatus)
        : undefined,
    leaveType:
      leaveTypeParam === "annual" || leaveTypeParam === "casual" || leaveTypeParam === "sick"
        ? (leaveTypeParam as LeaveType)
        : undefined,
    employeeId: params.employeeId || undefined,
  };

  const [employeesResult, requestsResult] = await Promise.all([
    listEmployees({ includeInactive: false }),
    listLeaveRequests(filters),
  ]);

  const employees = employeesResult.data.map(serializeEmployee);
  const requests = requestsResult.data.map(serializeLeaveRequest);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Leave requests</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Review and approve casual and sick leave requests from employees.
        </p>
      </div>

      <LeaveManager employees={employees} requests={requests} filters={filters} />
    </div>
  );
}
