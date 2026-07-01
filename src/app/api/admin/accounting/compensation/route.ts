import { NextResponse } from "next/server";
import { listCompensation } from "@/lib/accounting/compensation-service";
import { serializeCompensationListItem } from "@/lib/accounting/serialize";
import {
  getAccountingCompanyId,
  requireApiAccountingOrAdminSession,
} from "@/lib/auth/require-session";

export async function GET(request: Request) {
  const authResult = await requireApiAccountingOrAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const companyId = await getAccountingCompanyId(authResult.session);
  if (!companyId) {
    return NextResponse.json({ error: "No company selected", code: "NO_COMPANY" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") ?? undefined;

  const result = await listCompensation({ companyId, search });
  return NextResponse.json({
    compensation: result.data.map((item) => serializeCompensationListItem(item)),
  });
}
