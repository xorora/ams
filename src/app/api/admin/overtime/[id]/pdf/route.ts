import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin/api-response";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { buildOvertimeSlipPdf, overtimeSlipPdfFilename } from "@/lib/attendance/overtime-pdf";
import { requireApiAdminSession } from "@/lib/auth/require-session";
import { getOvertimeRequestForPdf } from "@/lib/overtime/overtime-request-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  const companyId = (await getSelectedCompanyId()) ?? undefined;
  const result = await getOvertimeRequestForPdf(id, companyId);

  if (!result.ok) {
    return adminErrorResponse(result);
  }

  const buffer = await buildOvertimeSlipPdf(result.data);
  const filename = overtimeSlipPdfFilename(result.data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
