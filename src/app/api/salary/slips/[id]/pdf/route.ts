import { NextResponse } from "next/server";
import { buildSalarySlipPdf, salarySlipPdfFilename } from "@/lib/accounting/salary-slip-pdf";
import { getEmployeeSalarySlip } from "@/lib/accounting/salary-slip-service";
import { adminErrorResponse } from "@/lib/admin/api-response";
import { requireApiEmployeeSession } from "@/lib/auth/require-session";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiEmployeeSession();
  if (authResult.response) {
    return authResult.response;
  }

  const employeeId = authResult.session.user.employeeId;
  if (!employeeId) {
    return NextResponse.json({ error: "Forbidden", code: "EMPLOYEE_NOT_LINKED" }, { status: 403 });
  }

  const { id } = await context.params;
  const result = await getEmployeeSalarySlip(id, employeeId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  const buffer = await buildSalarySlipPdf(result.data);
  const filename = salarySlipPdfFilename(result.data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
