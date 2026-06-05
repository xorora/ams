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
  startEmployeeProbation,
  type UpdateEmployeeInput,
  updateEmployee,
} from "@/lib/admin/employees-service";
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
  const result = await createEmployee(input);
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

export async function createAttendanceAction(input: CreateAttendanceInput): Promise<ActionResult> {
  const session = await requireAdminSession();
  const result = await createAttendance(session.user.id, input);
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
  const result = await updateAttendance(id, session.user.id, input);
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
  const result = await markAttendanceStatus(id, session.user.id, status);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminAttendance();
  return actionSuccess();
}

export async function deleteAttendanceAction(id: string): Promise<ActionResult> {
  await requireAdminSession();
  const result = await deleteAttendance(id);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateAdminAttendance();
  return actionSuccess();
}
