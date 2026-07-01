import { NextResponse } from "next/server";
import {
  getSalarySlip,
  type UpdateSalarySlipInput,
  updateSalarySlip,
} from "@/lib/accounting/salary-slip-service";
import { serializeSalarySlipDetail } from "@/lib/accounting/serialize";
import { adminErrorResponse, parseJsonError } from "@/lib/admin/api-response";
import { requireApiAccountingOrAdminSession } from "@/lib/auth/require-session";

type RouteContext = { params: Promise<{ id: string }> };

function getAccountingScope(
  session: Awaited<ReturnType<typeof requireApiAccountingOrAdminSession>>["session"],
) {
  return {
    role: session?.user.role as "admin" | "accounting_admin",
    companyId: session?.user.role === "accounting_admin" ? session?.user.assignedCompanyId : null,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiAccountingOrAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  const scope = getAccountingScope(authResult.session);

  if (scope.role === "accounting_admin" && !scope.companyId) {
    return NextResponse.json(
      { error: "No company assignment configured", code: "NO_COMPANY" },
      { status: 400 },
    );
  }

  const result = await getSalarySlip(id, scope);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ salarySlip: serializeSalarySlipDetail(result.data) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireApiAccountingOrAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  const scope = getAccountingScope(authResult.session);

  if (scope.role === "accounting_admin" && !scope.companyId) {
    return NextResponse.json(
      { error: "No company assignment configured", code: "NO_COMPANY" },
      { status: 400 },
    );
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

  const result = await updateSalarySlip(
    id,
    body as UpdateSalarySlipInput,
    scope,
    authResult.session.user.id,
  );
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ salarySlip: serializeSalarySlipDetail(result.data) });
}
