import { NextResponse } from "next/server";
import { adminErrorResponse, parseJsonError } from "@/lib/admin/api-response";
import {
  deleteAttendance,
  getAttendance,
  type UpdateAttendanceInput,
  updateAttendance,
} from "@/lib/admin/attendance-service";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { serializeAttendance } from "@/lib/admin/serialize";
import { requireApiAdminSession } from "@/lib/auth/require-session";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "No company selected", code: "NO_COMPANY" }, { status: 400 });
  }
  const result = await getAttendance(id, companyId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ attendance: serializeAttendance(result.data) });
}

export async function PATCH(request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  const companyId = await getSelectedCompanyId();
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

  const result = await updateAttendance(
    id,
    authResult.session.user.id,
    body as UpdateAttendanceInput,
    companyId,
  );
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ attendance: serializeAttendance(result.data) });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = await context.params;
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "No company selected", code: "NO_COMPANY" }, { status: 400 });
  }
  const result = await deleteAttendance(id, companyId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ ok: true, id: result.data.id });
}
