"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import {
  type AttendanceStatus,
  type CreateAttendanceInput,
  createAttendance,
  deleteAttendance,
  markAttendanceStatus,
  type UpdateAttendanceInput,
  updateAttendance,
} from "@/lib/admin/attendance-service";
import {
  type CreateEmployeeInput,
  createEmployee,
  deactivateEmployee,
  endEmployeeProbation,
  getEmployeeDeactivationPreview,
  setEmployeePassword,
  startEmployeeProbation,
  type UpdateEmployeeInput,
  updateEmployee,
} from "@/lib/admin/employees-service";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { requireAdminSession } from "@/lib/auth/require-session";

function revalidateAdminAttendance() {
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/reports");
}

function revalidateAdminEmployees() {
  revalidatePath("/admin/employees");
  revalidatePath("/dashboard");
}

export async function createEmployeeAction(input: CreateEmployeeInput): Promise<ActionResult> {
  await requireAdminSession();
  const companyId = input.companyId?.trim() || (await getSelectedCompanyId());
  if (!companyId) {
    return actionFailure({
      ok: false,
      message: "No company selected.",
      code: "NO_COMPANY",
    });
  }
  const result = await createEmployee({ ...input, companyId });
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminEmployees();
  return actionSuccess();
}

export async function updateEmployeeAction(
  id: string,
  input: UpdateEmployeeInput,
): Promise<ActionResult> {
  await requireAdminSession();
  const result = await updateEmployee(id, input);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminEmployees();
  revalidatePath("/admin/attendance");
  return actionSuccess();
}

export async function getEmployeeDeactivationPreviewAction(
  id: string,
): Promise<
  ActionResult<{ hasOpenShift: boolean; openShiftState: "checked_in" | "on_break" | null }>
> {
  await requireAdminSession();
  const result = await getEmployeeDeactivationPreview(id);
  if (!result.ok) {
    return actionFailure(result);
  }
  return actionSuccess(result.data);
}

export async function deactivateEmployeeAction(
  id: string,
  options?: { closeOpenShift?: boolean },
): Promise<ActionResult> {
  await requireAdminSession();
  const result = await deactivateEmployee(id, options);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminEmployees();
  revalidatePath("/admin/attendance");
  return actionSuccess();
}

export async function reactivateEmployeeAction(id: string): Promise<ActionResult> {
  return updateEmployeeAction(id, { isActive: true });
}

export async function startEmployeeProbationAction(
  id: string,
  options?: { periodMonths?: number },
): Promise<ActionResult> {
  await requireAdminSession();
  const result = await startEmployeeProbation(id, options);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminEmployees();
  return actionSuccess();
}

export async function endEmployeeProbationAction(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const result = await endEmployeeProbation(id);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminEmployees();
  return actionSuccess();
}

export async function setEmployeePasswordAction(
  id: string,
  password: string,
): Promise<ActionResult> {
  await requireAdminSession();
  const result = await setEmployeePassword(id, password);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminEmployees();
  return actionSuccess();
}

export async function createAttendanceAction(input: CreateAttendanceInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return actionFailure({
      ok: false,
      message: "No company selected.",
      code: "NO_COMPANY",
    });
  }
  const result = await createAttendance(session.user.id, input, companyId);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminAttendance();
  return actionSuccess();
}

export async function updateAttendanceAction(
  id: string,
  input: UpdateAttendanceInput,
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return actionFailure({
      ok: false,
      message: "No company selected.",
      code: "NO_COMPANY",
    });
  }
  const result = await updateAttendance(id, session.user.id, input, companyId);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminAttendance();
  return actionSuccess();
}

export async function markAttendanceStatusAction(
  id: string,
  status: AttendanceStatus,
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return actionFailure({
      ok: false,
      message: "No company selected.",
      code: "NO_COMPANY",
    });
  }
  const result = await markAttendanceStatus(id, session.user.id, status, companyId);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminAttendance();
  return actionSuccess();
}

export async function deleteAttendanceAction(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return actionFailure({
      ok: false,
      message: "No company selected.",
      code: "NO_COMPANY",
    });
  }
  const result = await deleteAttendance(id, companyId);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminAttendance();
  return actionSuccess();
}

export async function fixLateGraceMinuteCheckInsAction(): Promise<
  ActionResult<{ updated: number }>
> {
  await requireAdminSession();
  const { fixLateGraceMinuteCheckIns } = await import("@/lib/admin/fix-late-grace-minute");
  const result = await fixLateGraceMinuteCheckIns();
  revalidateAdminAttendance();
  revalidatePath("/admin/reports");
  revalidatePath("/dashboard");
  return actionSuccess({ updated: result.updated });
}

export async function deleteShahbazSickLeave20260707Action(): Promise<
  ActionResult<{ deleted: number; sickRemainingAfter: number | null }>
> {
  await requireAdminSession();
  const { deleteShahbazSickLeave20260707 } = await import(
    "@/lib/admin/delete-shahbaz-sick-leave"
  );
  const result = await deleteShahbazSickLeave20260707();
  revalidatePath("/admin/leave");
  revalidatePath("/leave");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/reports");
  revalidatePath("/", "layout");
  return actionSuccess({
    deleted: result.deleted,
    sickRemainingAfter: result.matches[0]?.sickRemainingAfter ?? null,
  });
}

export async function consolidateDuplicateEmployeesAction(): Promise<
  ActionResult<{
    clustersMerged: number;
    siblingsDeactivated: number;
    attendanceMoved: number;
    punchesRelinked: number;
    codesAlignedToZktime: number;
  }>
> {
  await requireAdminSession();
  const companyId = await getSelectedCompanyId();
  if (!companyId) {
    return actionFailure({
      ok: false,
      message: "No company selected.",
      code: "NO_COMPANY",
    });
  }

  // Refresh ZKTime master data first so badge codes are available for alignment.
  try {
    const { isZktimeConfigured } = await import("@/lib/zktime/config");
    if (isZktimeConfigured()) {
      const { ZktimeClient } = await import("@/lib/zktime/client");
      const { pullEmployeesFromZktime } = await import("@/lib/zktime/employee-sync");
      await pullEmployeesFromZktime(ZktimeClient.fromEnv());
    }
  } catch (error) {
    console.warn("[consolidate-duplicates] ZKTime pull failed; continuing with Xorora Punch data", error);
  }

  const { consolidateDuplicateEmployees } = await import(
    "@/lib/admin/consolidate-duplicate-employees"
  );
  const result = await consolidateDuplicateEmployees({ companyId });
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidateAdminEmployees();
  revalidateAdminAttendance();
  revalidatePath("/admin/reports");
  revalidatePath("/admin/devices");
  return actionSuccess({
    clustersMerged: result.data.clustersMerged,
    siblingsDeactivated: result.data.siblingsDeactivated,
    attendanceMoved: result.data.attendanceMoved,
    punchesRelinked: result.data.punchesRelinked,
    codesAlignedToZktime: result.data.codesAlignedToZktime,
  });
}
