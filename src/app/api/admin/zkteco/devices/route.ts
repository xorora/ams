import { NextResponse } from "next/server";
import { requireApiAdminSession } from "@/lib/auth/require-session";
import { listZktecoDevicesWithSyncState } from "@/lib/zkteco/employee-sync";

export async function GET() {
  const authResult = await requireApiAdminSession();
  if (authResult.response) {
    return authResult.response;
  }

  const devices = await listZktecoDevicesWithSyncState();
  return NextResponse.json({ devices });
}
