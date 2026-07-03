import { NextResponse } from "next/server";
import { adminErrorResponse, parseJsonError } from "@/lib/admin/api-response";
import {
  type AttendanceStatus,
  type CreateAttendanceInput,
  createAttendance,
  listAttendance,
} from "@/lib/admin/attendance-service";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { serializeAttendance } from "@/lib/admin/serialize";
import { requireApiAdminSession } from "@/lib/auth/require-session";

function parseStatus(value: string | null): AttendanceStatus | undefined {
  if (value === "present" || value === "absent" || value === "leave" || value === "weekend_off") {
    return value;
  }
  return undefined;
}

export async function GET(request: Request) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;
  const employeeId = searchParams.get("employeeId") ?? undefined;
  const status = parseStatus(searchParams.get("status"));
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "50", 10);
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "No company selected", code: "NO_COMPANY" }, { status: 400 });
  }

  const result = await listAttendance({
    from,
    to,
    employeeId,
    status,
    page: Number.isNaN(page) ? 1 : page,
    limit: Number.isNaN(limit) ? 50 : limit,
    companyId,
  });

  return NextResponse.json({
    items: result.data.items.map(serializeAttendance),
    total: result.data.total,
    page: result.data.page,
    limit: result.data.limit,
  });
}

export async function POST(request: Request) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
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

  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return NextResponse.json({ error: "No company selected", code: "NO_COMPANY" }, { status: 400 });
  }

  const result = await createAttendance(authResult.session.user.id, body as CreateAttendanceInput, companyId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ attendance: serializeAttendance(result.data) }, { status: 201 });
}
