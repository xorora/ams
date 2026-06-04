import { Suspense } from "react";
import { ReportsEmployeeView } from "@/components/admin/reports-employee-view";
import { requireAdminSession } from "@/lib/auth/require-session";

type PageProps = {
  params: Promise<{ employeeId: string }>;
};

export default async function AdminEmployeeReportPage({ params }: PageProps) {
  await requireAdminSession();
  const { employeeId } = await params;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Employee report</h1>
      </div>

      <Suspense fallback={<p className="text-muted-foreground text-sm">Loading report…</p>}>
        <ReportsEmployeeView employeeId={employeeId} />
      </Suspense>
    </div>
  );
}
