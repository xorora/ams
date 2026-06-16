import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin/api-response";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { requireApiAdminSession } from "@/lib/auth/require-session";
import { buildLeaveApplicationPdf, leaveApplicationPdfFilename } from "@/lib/leave/leave-pdf";
import { getLeaveRequestForPdf } from "@/lib/leave/leave-service";

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
  const result = await getLeaveRequestForPdf(id, companyId);

  if (!result.ok) {
    return adminErrorResponse(result);
  }

  const buffer = await buildLeaveApplicationPdf(result.data);
  const filename = leaveApplicationPdfFilename(result.data);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
