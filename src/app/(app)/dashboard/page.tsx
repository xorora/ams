import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { EmployeeDashboard } from "@/components/attendance/employee-dashboard";
import {
  type DashboardEmployeeProfile,
  EmployeeDashboardProfile,
} from "@/components/attendance/employee-dashboard-profile";
import { NewEmployeeCodeToast } from "@/components/auth/new-employee-code-toast";
import { db } from "@/db";
import { companies } from "@/db/schema";
import { getEmployee } from "@/lib/admin/employees-service";
import { isCurrentlyOnProbation } from "@/lib/admin/probation";
import {
  getShiftConfigForEmployee,
  getShiftScheduleLabels,
} from "@/lib/attendance/company-shift";
import { type SerializedTodayStatus, serializeTodayStatus } from "@/lib/attendance/serialize";
import { getTodayStatus } from "@/lib/attendance/service";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";
import { needsEmployeeRegistration } from "@/lib/auth/navigation";
import { requireSession } from "@/lib/auth/require-session";
import { canEmployeeAccessLeave } from "@/lib/leave/access";
import { getLeaveBalances, getUnpaidLeaveSummary } from "@/lib/leave/leave-service";
import type { LeaveBalance, UnpaidLeaveSummary } from "@/lib/leave/types";

function shiftPresetLabel(preset: string | null | undefined): string | null {
  switch (preset) {
    case "afternoon":
      return "Afternoon";
    case "evening":
      return "Evening";
    case "day":
      return "Day";
    default:
      return null;
  }
}

async function loadEmployeeProfile(
  employeeId: string,
): Promise<DashboardEmployeeProfile | null> {
  const employeeResult = await getEmployee(employeeId);
  if (!employeeResult.ok) {
    return null;
  }

  const employee = employeeResult.data;
  const [company] = await db
    .select({ name: companies.name, slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, employee.companyId))
    .limit(1);

  const shiftConfig = getShiftConfigForEmployee(
    company?.slug ?? "xorora",
    employee.shiftPreset,
    employee.fullName,
  );
  const hours = getShiftScheduleLabels(shiftConfig);

  return {
    fullName: employee.fullName,
    employeeCode: employee.employeeCode,
    email: employee.email,
    department: employee.department,
    designation: employee.designation,
    companyName: company?.name ?? null,
    shiftLabel: shiftPresetLabel(employee.shiftPreset),
    shiftHours: `${hours.expectedCheckInTime} – ${hours.expectedCheckOutTime}`,
    isActive: employee.isActive,
    onProbation: isCurrentlyOnProbation(employee),
  };
}

export default async function DashboardPage() {
  const session = await requireSession();

  if (needsEmployeeRegistration(session.user)) {
    redirect("/register");
  }
  const employeeId = session.user.employeeId;
  const canCheckIn = hasLinkedEmployee(session);

  let initialStatus: SerializedTodayStatus | null = null;
  const loadError: string | null = null;
  let showLeaveOverview = false;
  let probationUnpaidOnly = false;
  let leaveBalances: LeaveBalance[] = [];
  let unpaidSummary: UnpaidLeaveSummary = { used: 0, pending: 0, total: 0 };
  let employeeProfile: DashboardEmployeeProfile | null = null;

  if (canCheckIn && employeeId) {
    const [result, canApply, profile] = await Promise.all([
      getTodayStatus(employeeId),
      canEmployeeAccessLeave(session.user),
      loadEmployeeProfile(employeeId),
    ]);

    initialStatus = serializeTodayStatus(result.data);
    employeeProfile = profile;
    probationUnpaidOnly = profile?.onProbation ?? false;
    showLeaveOverview = canApply;

    if (canApply) {
      if (probationUnpaidOnly) {
        const unpaidResult = await getUnpaidLeaveSummary(employeeId);
        unpaidSummary = unpaidResult.ok ? unpaidResult.data : unpaidSummary;
      } else {
        const balancesResult = await getLeaveBalances(employeeId);
        leaveBalances = balancesResult.ok ? balancesResult.data : [];
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-3 p-3 sm:gap-3.5 sm:p-4 md:p-6">
      <Suspense fallback={null}>
        <NewEmployeeCodeToast />
      </Suspense>

      {employeeProfile ? (
        <EmployeeDashboardProfile profile={employeeProfile} />
      ) : (
        <header className="relative overflow-hidden rounded-xl border border-white/15 bg-[#0a1230] px-4 py-3.5 sm:px-5 sm:py-4">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_0%_0%,#464c9f40,transparent_55%)]"
          />
          <div className="relative space-y-1.5">
            <p className="font-mono text-[10px] font-semibold tracking-[0.18em] text-[#f26b21] uppercase">
              Asia/Karachi · PKT
            </p>
            <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">Dashboard</h1>
            <p className="max-w-xl text-sm font-medium leading-relaxed text-[#d7dceb]">
              {session.user.role === "admin"
                ? "Add an employee record with your corporate email under Admin → Employees to enable check-in here."
                : "Your account is not linked to an employee record yet."}
            </p>
          </div>
        </header>
      )}

      {canCheckIn ? (
        <EmployeeDashboard
          initialStatus={initialStatus}
          loadError={loadError}
          showLeaveOverview={showLeaveOverview}
          probationUnpaidOnly={probationUnpaidOnly}
          leaveBalances={leaveBalances}
          unpaidSummary={unpaidSummary}
        />
      ) : (
        <div className="rounded-xl border border-white/15 bg-[#0a1230] p-4 text-sm font-medium leading-relaxed text-[#d7dceb]">
          {session.user.role === "admin" ? (
            <p>
              Use the admin section in the sidebar for team attendance. To check in for yourself,
              create an employee entry in Admin → Employees, then sign in with that employee code
              and the same email you use for Xorora Punch.
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
