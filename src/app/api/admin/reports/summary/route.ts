import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin/api-response";
import { serializeSummaryReport } from "@/lib/admin/reports-serialize";
import { getSummaryReport } from "@/lib/admin/reports-service";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { requireApiAdminSession } from "@/lib/auth/require-session";

export async function GET(request: Request) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const companyId = (await getSelectedCompanyId()) ?? undefined;

  const result = await getSummaryReport(from, to, companyId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ report: serializeSummaryReport(result.data) });
}
