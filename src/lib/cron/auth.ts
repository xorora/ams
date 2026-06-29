import { NextResponse } from "next/server";

export function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export function cronNotConfiguredResponse() {
  return NextResponse.json(
    { error: "Cron is not configured", code: "CRON_NOT_CONFIGURED" },
    { status: 500 },
  );
}

export function cronUnauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
}

export function wdmsNotConfiguredResponse() {
  return NextResponse.json(
    { error: "WDMS is not configured", code: "WDMS_NOT_CONFIGURED" },
    { status: 500 },
  );
}
