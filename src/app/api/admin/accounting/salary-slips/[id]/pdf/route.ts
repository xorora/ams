import { NextResponse } from "next/server";
import { buildSalarySlipPdf, salarySlipPdfFilename } from "@/lib/accounting/salary-slip-pdf";
import { getSalarySlip } from "@/lib/accounting/salary-slip-service";
import { adminErrorResponse } from "@/lib/admin/api-response";
import { requireApiAccountingOrAdminSession } from "@/lib/auth/require-session";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiAccountingOrAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  const scope = {
    role: authResult.session.user.role as "admin" | "accounting_admin",
    companyId:
      authResult.session.user.role === "accounting_admin"
        ? authResult.session.user.assignedCompanyId
        : null,
  };

  const result = await getSalarySlip(id, scope);
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
