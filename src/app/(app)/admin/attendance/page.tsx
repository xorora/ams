import { eq } from "drizzle-orm";
import { AttendanceManager } from "@/components/admin/attendance-manager";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { type AttendanceStatus, listAttendance } from "@/lib/admin/attendance-service";
import { listEmployees } from "@/lib/admin/employees-service";
import { normalizeAttendanceDateRange } from "@/lib/admin/query-params";
import { requireSelectedCompanyId } from "@/lib/admin/selected-company";
import { serializeAttendance, serializeEmployee } from "@/lib/admin/serialize";
import {
  getCompanyShiftConfig,
  getDefaultAttendanceFilterRange,
} from "@/lib/attendance/company-shift";
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
  const companyId = await requireSelectedCompanyId();
  const params = await searchParams;

  const statusParam = params.status ?? "";
  const [company] = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const shiftConfig = getCompanyShiftConfig(company?.slug ?? "xorora");
  const defaultShiftRange =
    !params.from && !params.to ? getDefaultAttendanceFilterRange(new Date(), shiftConfig) : null;
  const { from, to } = normalizeAttendanceDateRange(
    params.from ?? defaultShiftRange?.from ?? "",
    params.to ?? defaultShiftRange?.to ?? "",
  );
  const filters = {
    from,
    to,
    employeeId: params.employeeId ?? "",
    status: (statusParam === "present" ||
    statusParam === "absent" ||
    statusParam === "leave" ||
    statusParam === "weekend_off"
      ? statusParam
      : "") as "" | AttendanceStatus,
  };

  const employeesResult = await listEmployees({ companyId });
  const activeEmployees = employeesResult.ok
    ? employeesResult.data.filter((e) => e.isActive).map((employee) => serializeEmployee(employee))
    : [];

  const attendanceResult = await listAttendance({
    from: filters.from || undefined,
    to: filters.to || undefined,
    employeeId: filters.employeeId || undefined,
    status: filters.status || undefined,
    companyId,
  });

  const items = attendanceResult.data.items.map(serializeAttendance);

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:h-full md:overflow-hidden md:p-8">
      <div className="shrink-0">
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Shift dates and expected times depend on the selected company (Xorora night shift vs Crest
          LED day shift). Geofence, break limits, late fines, and other HR rules are shared. Times
          below are shown in Asia/Karachi.
        </p>
      </div>

      <AttendanceManager employees={activeEmployees} items={items} filters={filters} />
    </div>
  );
}
