import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin/api-response";
import { serializeEmployeeReport } from "@/lib/admin/reports-serialize";
import { getEmployeeReport } from "@/lib/admin/reports-service";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { requireApiAdminSession } from "@/lib/auth/require-session";

export async function GET(request: Request) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const companyId = (await getSelectedCompanyId()) ?? undefined;

  if (!employeeId) {
    return NextResponse.json(
      { error: "employeeId is required", code: "MISSING_EMPLOYEE_ID" },
      { status: 400 },
    );
  }

  const result = await getEmployeeReport(employeeId, from, to, companyId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ report: serializeEmployeeReport(result.data) });
}
