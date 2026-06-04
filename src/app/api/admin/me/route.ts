import { NextResponse } from "next/server";
import { requireApiAdminSession } from "@/lib/auth/require-session";

export async function GET() {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const { session } = authResult;
  return NextResponse.json({
    ok: true,
    userId: session.user.id,
    role: session.user.role,
  });
}
