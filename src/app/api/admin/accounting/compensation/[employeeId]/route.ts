import { NextResponse } from "next/server";
import {
  getCompensation,
  type UpsertCompensationInput,
  upsertCompensation,
} from "@/lib/accounting/compensation-service";
import { serializeCompensation } from "@/lib/accounting/serialize";
import { adminErrorResponse, parseJsonError } from "@/lib/admin/api-response";
import {
  getAccountingCompanyId,
  requireApiAccountingOrAdminSession,
} from "@/lib/auth/require-session";

type RouteContext = { params: Promise<{ employeeId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiAccountingOrAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const companyId = await getAccountingCompanyId(authResult.session);
  if (!companyId) {
    return NextResponse.json({ error: "No company selected", code: "NO_COMPANY" }, { status: 400 });
  }

  const { employeeId } = await context.params;
  const result = await getCompensation(employeeId, companyId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ compensation: serializeCompensation(result.data) });
}

export async function PUT(request: Request, context: RouteContext) {
  const authResult = await requireApiAccountingOrAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const companyId = await getAccountingCompanyId(authResult.session);
  if (!companyId) {
    return NextResponse.json({ error: "No company selected", code: "NO_COMPANY" }, { status: 400 });
  }

  const { employeeId } = await context.params;

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

  const result = await upsertCompensation(
    employeeId,
    companyId,
    authResult.session.user.id,
    body as UpsertCompensationInput,
  );
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ compensation: serializeCompensation(result.data) });
}
