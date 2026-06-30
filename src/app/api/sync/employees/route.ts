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

type SyncEmployeesPostBody = {
  departments?: Array<{ id: number; name: string }>;
  employees?: Array<{
    emp_code: string;
    full_name: string;
    department_id?: number;
    department_name?: string;
  }>;
  queue_to_device?: boolean;
  pushAll?: boolean;
};

function isSyncEmployeesPostBody(value: unknown): value is SyncEmployeesPostBody {
  return Boolean(value && typeof value === "object");
}

function mapPostEmployees(
  employees: NonNullable<SyncEmployeesPostBody["employees"]>,
): ZktimeEmployeeUpsertRequest[] {
  return employees.map((employee) => ({
    emp_code: employee.emp_code,
    full_name: employee.full_name,
    department_id: employee.department_id,
    department_name: employee.department_name,
    ams_department_id: employee.department_id,
  }));
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
    const result = await pullEmployeesFromZktime(client);

    return NextResponse.json({
      source: "zktime",
      synced: result.fetched,
      created: result.created,
      updated: result.updated,
      employees: result.employees,
    });
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

    if (!isSyncEmployeesPostBody(body) || body.pushAll === true || Object.keys(body).length === 0) {
      const result = await pushAllOrganizationalDataToZktime(client);
      return NextResponse.json({ source: "zktime", ...result });
    }

    const employees = body.employees ?? [];
    if (employees.length === 0) {
      return NextResponse.json(
        { error: "No employees provided", code: "INVALID_BODY" },
        { status: 400 },
      );
    }

    const result = await pushEmployeesToZktime(client, {
      departments: body.departments,
      employees: mapPostEmployees(employees),
      queue_to_device: body.queue_to_device,
    });

    return NextResponse.json({ source: "zktime", ...result });
  } catch (error) {
    console.error("[sync/employees] push", error);
    return NextResponse.json(
      { error: "Failed to push employees to ZKTime", code: "PUSH_FAILED" },
      { status: 500 },
    );
  }
}
