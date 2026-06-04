import { AttendanceManager } from "@/components/admin/attendance-manager";
import { type AttendanceStatus, listAttendance } from "@/lib/admin/attendance-service";
import { listEmployees } from "@/lib/admin/employees-service";
import { serializeAttendance, serializeEmployee } from "@/lib/admin/serialize";
import { requireAdminSession } from "@/lib/auth/require-session";

type PageProps = {
  searchParams: Promise<{
    from?: string;
    to?: string;
    employeeId?: string;
    status?: string;
  }>;
};

export default async function AdminAttendancePage({ searchParams }: PageProps) {
  await requireAdminSession();
  const params = await searchParams;

  const statusParam = params.status ?? "";
  const filters = {
    from: params.from ?? "",
    to: params.to ?? "",
    employeeId: params.employeeId ?? "",
    status: (statusParam === "present" || statusParam === "absent" || statusParam === "leave"
      ? statusParam
      : "") as "" | AttendanceStatus,
  };

  const employeesResult = await listEmployees();
  const activeEmployees = employeesResult.ok
    ? employeesResult.data.filter((e) => e.isActive).map(serializeEmployee)
    : [];

  const attendanceResult = await listAttendance({
    from: filters.from || undefined,
    to: filters.to || undefined,
    employeeId: filters.employeeId || undefined,
    status: filters.status || undefined,
  });

  const items = attendanceResult.data.items.map(serializeAttendance);
  const total = attendanceResult.data.total;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Shift dates follow the night-shift model (keyed by 6 PM check-in date in PKT). Times below
          are shown in Asia/Karachi.
        </p>
      </div>

      <AttendanceManager
        employees={activeEmployees}
        items={items}
        total={total}
        filters={filters}
      />
    </div>
  );
}
