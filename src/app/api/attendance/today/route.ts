import { NextResponse } from "next/server";
import { serializeTodayStatus } from "@/lib/attendance/serialize";
import { getTodayStatus } from "@/lib/attendance/service";
import { requireApiEmployeeSession } from "@/lib/auth/require-session";

export async function GET() {
  const authResult = await requireApiEmployeeSession();
  if (authResult.response) {
    return authResult.response;
  }

  const employeeId = authResult.session.user.employeeId;
  if (!employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await getTodayStatus(employeeId);
  return NextResponse.json(serializeTodayStatus(result.data));
}
