import { NextResponse } from "next/server";
import { parseJsonError, serviceErrorResponse } from "@/lib/attendance/api-response";
import { parseCoordinates } from "@/lib/attendance/coords";
import { serializeTodayStatus } from "@/lib/attendance/serialize";
import { checkIn } from "@/lib/attendance/service";
import { requireApiEmployeeSession } from "@/lib/auth/require-session";

export async function POST(request: Request) {
  const authResult = await requireApiEmployeeSession();
  if (authResult.response) {
    return authResult.response;
  }

  const employeeId = authResult.session.user.employeeId;
  if (!employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return parseJsonError();
  }

  const coordsResult = parseCoordinates(body);
  if (!coordsResult.ok) {
    return NextResponse.json(
      { error: coordsResult.message, code: coordsResult.code },
      { status: 400 },
    );
  }

  const result = await checkIn(employeeId, coordsResult.coords);
  if (!result.ok) {
    return serviceErrorResponse(result);
  }

  return NextResponse.json({
    message: result.data.message,
    status: serializeTodayStatus(result.data.status),
  });
}
