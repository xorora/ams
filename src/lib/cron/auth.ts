import { NextResponse } from "next/server";

export function getCronSecret(): string | undefined {
  const secret = process.env.CRON_SECRET?.trim();
  return secret || undefined;
}

export function verifyCronAuth(request: Request): boolean {
  const secret = getCronSecret();
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

export function zktimeNotConfiguredResponse() {
  return NextResponse.json(
    { error: "ZKTime is not configured", code: "ZKTIME_NOT_CONFIGURED" },
    { status: 500 },
  );
}
