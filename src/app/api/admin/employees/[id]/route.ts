import { NextResponse } from "next/server";
import { adminErrorResponse, parseJsonError } from "@/lib/admin/api-response";
import {
  deactivateEmployee,
  getEmployee,
  type UpdateEmployeeInput,
  updateEmployee,
} from "@/lib/admin/employees-service";
import { serializeEmployee } from "@/lib/admin/serialize";
import { requireApiAdminSession } from "@/lib/auth/require-session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  const result = await getEmployee(id);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ employee: serializeEmployee(result.data) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;

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

  const result = await updateEmployee(id, body as UpdateEmployeeInput);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ employee: serializeEmployee(result.data) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  const result = await deactivateEmployee(id);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ employee: serializeEmployee(result.data) });
}
