import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin/api-response";
import {
  buildEmployeeExcel,
  buildSummaryExcel,
  employeeExportFilename,
  summaryExportFilename,
} from "@/lib/admin/reports-excel";
import { getEmployeeReport, getSummaryReport } from "@/lib/admin/reports-service";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { requireApiAdminSession } from "@/lib/auth/require-session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const employeeId = searchParams.get("employeeId");
  const companyId = (await getSelectedCompanyId()) ?? undefined;

  if (scope !== "summary" && scope !== "employee") {
    return NextResponse.json(
      { error: "scope must be summary or employee", code: "INVALID_SCOPE" },
      { status: 400 },
    );
  }

  if (scope === "employee") {
    if (!employeeId) {
      return NextResponse.json(
        { error: "employeeId is required for employee export", code: "MISSING_EMPLOYEE_ID" },
        { status: 400 },
      );
    }

    const result = await getEmployeeReport(employeeId, from, to, companyId);
    if (!result.ok) {
      return adminErrorResponse(result);
    }

    const buffer = await buildEmployeeExcel(result.data);
    const filename = employeeExportFilename(
      result.data.employee.employeeCode,
      result.data.range.from,
      result.data.range.to,
    );

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const result = await getSummaryReport(from, to, companyId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  const buffer = await buildSummaryExcel(result.data);
  const filename = summaryExportFilename(result.data.range.from, result.data.range.to);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
