"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionFailure,
  type ActionResult,
  actionFailure,
  actionSuccess,
} from "@/lib/actions/result";
import { requireAdminSession } from "@/lib/auth/require-session";
import { syncAttendanceFromWdms } from "@/lib/wdms/attendance-sync";
import { WdmsClient } from "@/lib/wdms/client";
import { isWdmsConfigured } from "@/lib/wdms/config";
import {
  pullEmployeesFromWdms,
  pushCompanyToWdms,
  syncTerminalsFromWdms,
} from "@/lib/wdms/employee-sync";
import { resetAndPushAllCompaniesToWdms } from "@/lib/wdms/wipe";

function revalidateAdminDevices() {
  revalidatePath("/admin/devices");
}

function wdmsNotConfiguredFailure(): ActionFailure {
  return actionFailure({
    ok: false,
    code: "WDMS_NOT_CONFIGURED",
    message: "WDMS is not configured. Set WDMS_BASE_URL, WDMS_USERNAME, and WDMS_PASSWORD.",
  });
}

export async function triggerWdmsAttendanceSyncAction(): Promise<
  ActionResult<{ fetched: number; inserted: number; since: string; latest: string | null }>
> {
  await requireAdminSession();

  if (!isWdmsConfigured()) {
    return wdmsNotConfiguredFailure();
  }

  try {
    const client = WdmsClient.fromEnv();
    const result = await syncAttendanceFromWdms(client);
    await syncTerminalsFromWdms(client);
    revalidateAdminDevices();
    return actionSuccess(result);
  } catch (error) {
    console.error("[wdms/actions] attendance sync failed", error);
    return actionFailure({
      ok: false,
      code: "WDMS_SYNC_FAILED",
      message: "Failed to sync attendance from WDMS.",
    });
  }
}

export async function triggerWdmsEmployeeSyncAction(): Promise<
  ActionResult<{ fetched: number; updated: number; created: number }>
> {
  await requireAdminSession();

  if (!isWdmsConfigured()) {
    return wdmsNotConfiguredFailure();
  }

  try {
    const client = WdmsClient.fromEnv();
    const result = await pullEmployeesFromWdms(client);
    revalidateAdminDevices();
    return actionSuccess(result);
  } catch (error) {
    console.error("[wdms/actions] employee sync failed", error);
    return actionFailure({
      ok: false,
      code: "WDMS_SYNC_FAILED",
      message: "Failed to sync employees from WDMS.",
    });
  }
}

export async function triggerWdmsCompanyPushAction(): Promise<
  ActionResult<{
    companies: Array<{
      companyName: string;
      companySlug: string;
      companiesCreated: number;
      areasCreated: number;
      departmentsCreated: number;
      employeesPushed: number;
      employeesSkipped: number;
      failures: Array<{ employeeCode: string; department: string; message: string }>;
    }>;
    totals: {
      companiesCreated: number;
      areasCreated: number;
      departmentsCreated: number;
      employeesPushed: number;
      employeesSkipped: number;
      failures: number;
    };
  }>
> {
  await requireAdminSession();

  if (!isWdmsConfigured()) {
    return wdmsNotConfiguredFailure();
  }

  try {
    const client = WdmsClient.fromEnv();
    const result = await pushCompanyToWdms(client);
    if ("totals" in result) {
      revalidateAdminDevices();
      return actionSuccess(result);
    }

    revalidateAdminDevices();
    return actionSuccess({
      companies: [result],
      totals: {
        companiesCreated: result.companiesCreated,
        areasCreated: result.areasCreated,
        departmentsCreated: result.departmentsCreated,
        employeesPushed: result.employeesPushed,
        employeesSkipped: result.employeesSkipped,
        failures: result.failures.length,
      },
    });
  } catch (error) {
    console.error("[wdms/actions] company push failed", error);
    return actionFailure({
      ok: false,
      code: "WDMS_PUSH_FAILED",
      message: error instanceof Error ? error.message : "Failed to push company data to WDMS.",
    });
  }
}

export async function triggerWdmsResetAndPushAction(): Promise<
  ActionResult<{
    wipe: {
      employeesDeleted: number;
      departmentsDeleted: number;
      areasDeleted: number;
      companiesDeleted: number;
      failures: string[];
    };
    push: {
      companies: Array<{
        companyName: string;
        companySlug: string;
        companiesCreated: number;
        areasCreated: number;
        departmentsCreated: number;
        employeesPushed: number;
        employeesSkipped: number;
        failures: Array<{ employeeCode: string; department: string; message: string }>;
      }>;
      totals: {
        companiesCreated: number;
        areasCreated: number;
        departmentsCreated: number;
        employeesPushed: number;
        employeesSkipped: number;
        failures: number;
      };
    };
  }>
> {
  await requireAdminSession();

  if (!isWdmsConfigured()) {
    return wdmsNotConfiguredFailure();
  }

  try {
    const client = WdmsClient.fromEnv();
    const result = await resetAndPushAllCompaniesToWdms(client);
    revalidateAdminDevices();
    return actionSuccess(result);
  } catch (error) {
    console.error("[wdms/actions] reset and push failed", error);
    return actionFailure({
      ok: false,
      code: "WDMS_RESET_FAILED",
      message: error instanceof Error ? error.message : "Failed to reset and push WDMS data.",
    });
  }
}

export async function triggerWdmsTerminalSyncAction(): Promise<ActionResult<{ count: number }>> {
  await requireAdminSession();

  if (!isWdmsConfigured()) {
    return wdmsNotConfiguredFailure();
  }

  try {
    const client = WdmsClient.fromEnv();
    const count = await syncTerminalsFromWdms(client);
    revalidateAdminDevices();
    return actionSuccess({ count });
  } catch (error) {
    console.error("[wdms/actions] terminal sync failed", error);
    return actionFailure({
      ok: false,
      code: "WDMS_SYNC_FAILED",
      message: "Failed to refresh device status from WDMS.",
    });
  }
}
