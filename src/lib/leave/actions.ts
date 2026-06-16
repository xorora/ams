"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import { requireAdminSession, requireEmployeeSession } from "@/lib/auth/require-session";
import {
  approveLeaveRequest,
  cancelLeaveRequest,
  getLeaveBalances,
  rejectLeaveRequest,
  type SubmitLeaveInput,
  submitLeaveRequest,
} from "./leave-service";
import type { LeaveBalance } from "./types";

function revalidateLeavePaths() {
  revalidatePath("/leave");
  revalidatePath("/admin/leave");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/reports");
  revalidatePath("/dashboard");
}

export async function submitLeaveRequestAction(input: SubmitLeaveInput): Promise<ActionResult> {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return actionFailure({ ok: false, message: "Employee record not linked.", code: "NOT_LINKED" });
  }

  const result = await submitLeaveRequest(employeeId, input);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateLeavePaths();
  return actionSuccess();
}

export async function cancelLeaveRequestAction(id: string): Promise<ActionResult> {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return actionFailure({ ok: false, message: "Employee record not linked.", code: "NOT_LINKED" });
  }

  const result = await cancelLeaveRequest(employeeId, id);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateLeavePaths();
  return actionSuccess();
}

export async function approveLeaveRequestAction(
  id: string,
  reviewNotes?: string | null,
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const result = await approveLeaveRequest(session.user.id, id, reviewNotes);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateLeavePaths();
  return actionSuccess();
}

export async function rejectLeaveRequestAction(
  id: string,
  reviewNotes?: string | null,
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const result = await rejectLeaveRequest(session.user.id, id, reviewNotes);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateLeavePaths();
  return actionSuccess();
}

export async function getLeaveBalancesAction(
  employeeId: string,
  year?: number,
): Promise<ActionResult<LeaveBalance[]>> {
  await requireAdminSession();
  const result = await getLeaveBalances(employeeId, year);
  if (!result.ok) {
    return actionFailure(result);
  }
  return actionSuccess(result.data);
}
