import { AttendanceManager } from "@/components/admin/attendance-manager";
import { requireAdminSession } from "@/lib/auth/require-session";

export default async function AdminAttendancePage() {
  await requireAdminSession();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Shift dates follow the night-shift model (keyed by 6 PM check-in date in PKT). Times below
          are shown in Asia/Karachi.
        </p>
      </div>

      <AttendanceManager />
    </div>
  );
}
