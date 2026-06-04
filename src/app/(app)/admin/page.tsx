import Link from "next/link";
import { requireAdminSession } from "@/lib/auth/require-session";

export default async function AdminPage() {
  await requireAdminSession();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage employees, attendance records, and reports.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/employees"
          className="rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30"
        >
          <h2 className="font-medium">Employees</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Create, edit, and deactivate employee records. Link corporate emails for Google sign-in.
          </p>
        </Link>
        <Link
          href="/admin/attendance"
          className="rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30"
        >
          <h2 className="font-medium">Attendance</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            View and filter shift records, edit times, mark present or absent, and add corrections.
          </p>
        </Link>
        <Link
          href="/admin/reports"
          className="rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/30"
        >
          <h2 className="font-medium">Reports</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            Summary and per-employee attendance totals with Excel export for payroll or audits.
          </p>
        </Link>
      </div>
    </div>
  );
}
