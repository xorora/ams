import { NextResponse } from "next/server";
import {
  cronNotConfiguredResponse,
  cronUnauthorizedResponse,
  deviceSyncNotConfiguredResponse,
  getCronSecret,
  verifyCronAuth,
} from "@/lib/cron/auth";
import { getDeviceSyncProvider } from "@/lib/device-sync/provider";
import { WdmsClient } from "@/lib/wdms/client";
import { pullEmployeesFromWdms } from "@/lib/wdms/employee-sync";
import { ZktimeClient } from "@/lib/zktime/client";
import { pullEmployeesFromZktime, pushEmployeesToZktime } from "@/lib/zktime/employee-sync";
import type { ZktimePushEmployeePayload } from "@/lib/zktime/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isPushPayload(value: unknown): value is { employees: ZktimePushEmployeePayload[] } {
  if (!value || typeof value !== "object" || !("employees" in value)) {
    return false;
  }

  const employees = (value as { employees: unknown }).employees;
  if (!Array.isArray(employees)) {
    return false;
  }

  return employees.every(
    (employee) =>
      employee &&
      typeof employee === "object" &&
      typeof (employee as ZktimePushEmployeePayload).emp_code === "string" &&
      typeof (employee as ZktimePushEmployeePayload).full_name === "string",
  );
}

export async function GET(request: Request) {
  if (!getCronSecret()) {
    return cronNotConfiguredResponse();
  }

  if (!verifyCronAuth(request)) {
    return cronUnauthorizedResponse();
  }

  const provider = getDeviceSyncProvider();
  if (!provider) {
    return deviceSyncNotConfiguredResponse();
  }

  try {
    if (provider === "zktime") {
      const client = ZktimeClient.fromEnv();
      const employees = await pullEmployeesFromZktime(client);
      return NextResponse.json({ ok: true, employees });
    }

    const client = WdmsClient.fromEnv();
    const employees = await pullEmployeesFromWdms(client);
    return NextResponse.json({ ok: true, employees });
  } catch (error) {
    console.error("[sync/employees] pull", error);
    return NextResponse.json(
      {
        error: `Failed to sync employees from ${provider === "zktime" ? "ZKTime" : "WDMS"}`,
        code: "SYNC_FAILED",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!getCronSecret()) {
    return cronNotConfiguredResponse();
  }

  if (!verifyCronAuth(request)) {
    return cronUnauthorizedResponse();
  }

  const provider = getDeviceSyncProvider();
  if (provider !== "zktime") {
    return NextResponse.json(
      {
        error: "Employee push requires ZKTime configuration",
        code: "ZKTIME_NOT_CONFIGURED",
      },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  if (!isPushPayload(body) || body.employees.length === 0) {
    return NextResponse.json(
      {
        error: 'Body must include a non-empty "employees" array with emp_code and full_name',
        code: "INVALID_BODY",
      },
      { status: 400 },
    );
  }

  try {
    const client = ZktimeClient.fromEnv();
    const result = await pushEmployeesToZktime(client, body.employees);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[sync/employees] push", error);
    return NextResponse.json(
      { error: "Failed to push employees to ZKTime", code: "PUSH_FAILED" },
      { status: 500 },
    );
  }
}
