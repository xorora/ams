import { NextResponse } from "next/server";
import {
  cronNotConfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  verifyCronAuth,
  zktimeNotConfiguredResponse,
} from "@/lib/cron/auth";
import { ZktimeClient } from "@/lib/zktime/client";
import { isZktimeConfigured } from "@/lib/zktime/config";
import { pullEmployeesFromZktime, pushEmployeesToZktime } from "@/lib/zktime/employee-sync";
import { pushAllOrganizationalDataToZktime } from "@/lib/zktime/organizational-push";
import type { ZktimeEmployeeUpsertRequest } from "@/lib/zktime/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isPushPayload(value: unknown): value is { employees: ZktimeEmployeeUpsertRequest[] } {
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
      typeof (employee as ZktimeEmployeeUpsertRequest).emp_code === "string" &&
      typeof (employee as ZktimeEmployeeUpsertRequest).full_name === "string",
  );
}

function isPushAllPayload(value: unknown): value is { pushAll: true } {
  return Boolean(value && typeof value === "object" && (value as { pushAll?: boolean }).pushAll);
}

export async function GET(request: Request) {
  if (!getCronSecret()) {
    return cronNotConfiguredResponse();
  }

  if (!verifyCronAuth(request)) {
    return cronUnauthorizedResponse();
  }

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredResponse();
  }

  try {
    const client = ZktimeClient.fromEnv();
    const employees = await pullEmployeesFromZktime(client);
    return NextResponse.json({ ok: true, employees });
  } catch (error) {
    console.error("[sync/employees] pull", error);
    return NextResponse.json(
      { error: "Failed to sync employees from ZKTime", code: "SYNC_FAILED" },
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

  if (!isZktimeConfigured()) {
    return zktimeNotConfiguredResponse();
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text);
    }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_BODY" }, { status: 400 });
  }

  try {
    const client = ZktimeClient.fromEnv();

    if (isPushAllPayload(body) || Object.keys(body as object).length === 0) {
      const result = await pushAllOrganizationalDataToZktime(client);
      return NextResponse.json({ ok: true, ...result });
    }

    if (!isPushPayload(body) || body.employees.length === 0) {
      return NextResponse.json(
        {
          error:
            'Send {"pushAll": true} to push all AMS data, or a non-empty "employees" array for targeted push',
          code: "INVALID_BODY",
        },
        { status: 400 },
      );
    }

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
