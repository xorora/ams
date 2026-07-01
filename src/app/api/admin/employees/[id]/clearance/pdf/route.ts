import { NextResponse } from "next/server";
import { adminErrorResponse } from "@/lib/admin/api-response";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { requireApiAdminSession } from "@/lib/auth/require-session";
import { buildClearanceFormPdf, clearanceFormPdfFilename } from "@/lib/clearance/clearance-pdf";
import {
  type ClearanceFormInput,
  getEmployeeClearancePdfData,
  validateClearanceFormInput,
} from "@/lib/clearance/clearance-service";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ClearancePdfRequest = ClearanceFormInput & {
  disposition?: "inline" | "attachment";
};

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  let body: ClearancePdfRequest;

  try {
    body = (await request.json()) as ClearancePdfRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validated = validateClearanceFormInput(body);
  if (!validated.ok) {
    return adminErrorResponse(validated);
  }

  const companyId = (await getSelectedCompanyId()) ?? undefined;
  const result = await getEmployeeClearancePdfData(id, validated.data, companyId);

  if (!result.ok) {
    return adminErrorResponse(result);
  }

  const buffer = await buildClearanceFormPdf(result.data);
  const filename = clearanceFormPdfFilename(result.data);
  const disposition = body.disposition === "inline" ? "inline" : "attachment";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${filename}"`,
    },
  });
}
