import { NextResponse } from "next/server";
import { runProcessMachinePunchesJob } from "@/lib/attendance/machine-punch-processor";

function verifyCronAuth(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Cron is not configured", code: "CRON_NOT_CONFIGURED" },
      { status: 500 },
    );
  }

  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runProcessMachinePunchesJob();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cron/process-machine-punches]", error);
    return NextResponse.json(
      { error: "Failed to process machine punches", code: "JOB_FAILED" },
      { status: 500 },
    );
  }
}
