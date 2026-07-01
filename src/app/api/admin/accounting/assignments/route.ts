import { NextResponse } from "next/server";
import {
  type CreateAssignmentInput,
  createAssignment,
  listAssignments,
} from "@/lib/accounting/assignments-service";
import { serializeAssignment } from "@/lib/accounting/serialize";
import { adminErrorResponse, parseJsonError } from "@/lib/admin/api-response";
import { requireApiAdminSession } from "@/lib/auth/require-session";

export async function GET() {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const result = await listAssignments();
  return NextResponse.json({
    assignments: result.data.map((assignment) => serializeAssignment(assignment)),
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

  const input = body as CreateAssignmentInput;
  const result = await createAssignment(input);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ assignment: serializeAssignment(result.data) }, { status: 201 });
}
