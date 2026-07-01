import { NextResponse } from "next/server";
import {
  type CreateSalarySlipInput,
  createSalarySlip,
  listSalarySlips,
} from "@/lib/accounting/salary-slip-service";
import { serializeSalarySlipDetail, serializeSalarySlipListItem } from "@/lib/accounting/serialize";
import { adminErrorResponse, parseJsonError } from "@/lib/admin/api-response";
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
  const yearMonth = searchParams.get("yearMonth") ?? undefined;
  const employeeId = searchParams.get("employeeId") ?? undefined;

  const result = await listSalarySlips({ companyId, yearMonth, employeeId });
  return NextResponse.json({
    salarySlips: result.data.map((item) => serializeSalarySlipListItem(item)),
  });
}

export async function POST(request: Request) {
  const authResult = await requireApiAccountingOrAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const companyId = await getAccountingCompanyId(authResult.session);
  if (!companyId) {
    return NextResponse.json({ error: "No company selected", code: "NO_COMPANY" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return parseJsonError();
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Request body must be an object", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const result = await createSalarySlip(
    body as CreateSalarySlipInput,
    companyId,
    authResult.session.user.id,
  );
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ salarySlip: serializeSalarySlipDetail(result.data) }, { status: 201 });
}
