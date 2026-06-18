"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import { requireAdminSession, requireEmployeeSession } from "@/lib/auth/require-session";
import {
  approveOvertimeRequest,
  cancelOvertimeRequest,
  rejectOvertimeRequest,
  type SubmitOvertimeRequestInput,
  submitOvertimeRequest,
} from "./overtime-request-service";

function revalidateOvertimePaths() {
  revalidatePath("/overtime");
  revalidatePath("/admin/overtime");
  revalidatePath("/attendance/history");
  revalidatePath("/dashboard");
  revalidatePath("/admin/attendance");
}

export async function submitOvertimeRequestAction(
  input: SubmitOvertimeRequestInput,
): Promise<ActionResult> {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return actionFailure({ ok: false, message: "Employee record not linked.", code: "NOT_LINKED" });
  }

  const result = await submitOvertimeRequest(employeeId, input);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateOvertimePaths();
  return actionSuccess();
}

export async function cancelOvertimeRequestAction(id: string): Promise<ActionResult> {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return actionFailure({ ok: false, message: "Employee record not linked.", code: "NOT_LINKED" });
  }

  const result = await cancelOvertimeRequest(employeeId, id);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateOvertimePaths();
  return actionSuccess();
}

export async function approveOvertimeRequestAction(
  id: string,
  reviewNotes?: string | null,
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const result = await approveOvertimeRequest(session.user.id, id, reviewNotes);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateOvertimePaths();
  return actionSuccess();
}

export async function rejectOvertimeRequestAction(
  id: string,
  reviewNotes?: string | null,
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const result = await rejectOvertimeRequest(session.user.id, id, reviewNotes);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateOvertimePaths();
  return actionSuccess();
}
