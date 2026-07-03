import { NextResponse } from "next/server";
import { adminErrorResponse, parseJsonError } from "@/lib/admin/api-response";
import { type AttendanceStatus, markAttendanceStatus } from "@/lib/admin/attendance-service";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { serializeAttendance } from "@/lib/admin/serialize";
import { requireApiAdminSession } from "@/lib/auth/require-session";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
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

  if (!body || typeof body !== "object" || !("status" in body)) {
    return NextResponse.json(
      { error: "Request body must include status", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const status = (body as { status: AttendanceStatus }).status;
  const result = await markAttendanceStatus(id, authResult.session.user.id, status, companyId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ attendance: serializeAttendance(result.data) });
}
