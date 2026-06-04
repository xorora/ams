import { NextResponse } from "next/server";
import { adminErrorResponse, parseJsonError } from "@/lib/admin/api-response";
import {
  type CreateEmployeeInput,
  createEmployee,
  listEmployees,
} from "@/lib/admin/employees-service";
import { serializeEmployee } from "@/lib/admin/serialize";
import { requireApiAdminSession } from "@/lib/auth/require-session";

export async function GET(request: Request) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";
  const search = searchParams.get("search") ?? undefined;

  const result = await listEmployees({ includeInactive, search });
  return NextResponse.json({
    employees: result.data.map(serializeEmployee),
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

  const input = body as CreateEmployeeInput;
  const result = await createEmployee(input);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ employee: serializeEmployee(result.data) }, { status: 201 });
}
