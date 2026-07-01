import { NextResponse } from "next/server";
import { removeAssignment } from "@/lib/accounting/assignments-service";
import { adminErrorResponse } from "@/lib/admin/api-response";
import { requireApiAdminSession } from "@/lib/auth/require-session";

type RouteContext = { params: Promise<{ userId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { userId } = await context.params;
  const result = await removeAssignment(userId);
  if (!result.ok) {
    return adminErrorResponse(result);
  }

  return NextResponse.json({ success: true });
}
