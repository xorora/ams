"use server";

import { revalidatePath, updateTag } from "next/cache";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import { requireAdminSession, requireEmployeeSession } from "@/lib/auth/require-session";
import {
  approveLateRelaxationRequest,
  cancelLateRelaxationRequest,
  rejectLateRelaxationRequest,
  submitLateRelaxationRequest,
} from "./late-relaxation-service";
import type { SubmitLateRelaxationInput } from "./types";

function revalidateRelaxationPaths() {
  revalidatePath("/relaxations");
  revalidatePath("/admin/relaxations");
  revalidatePath("/admin/employees");
  revalidatePath("/admin/reports");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard", "layout");
  updateTag("pending-late-relaxation");
}

export async function submitLateRelaxationRequestAction(
  input: SubmitLateRelaxationInput,
): Promise<ActionResult> {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return actionFailure({ ok: false, message: "Employee record not linked.", code: "NOT_LINKED" });
  }

  const result = await submitLateRelaxationRequest(employeeId, input);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateRelaxationPaths();
  return actionSuccess();
}

export async function cancelLateRelaxationRequestAction(id: string): Promise<ActionResult> {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return actionFailure({ ok: false, message: "Employee record not linked.", code: "NOT_LINKED" });
  }

  const result = await cancelLateRelaxationRequest(employeeId, id);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateRelaxationPaths();
  return actionSuccess();
}

export async function approveLateRelaxationRequestAction(
  id: string,
  reviewNotes?: string | null,
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const result = await approveLateRelaxationRequest(session.user.id, id, reviewNotes);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateRelaxationPaths();
  return actionSuccess();
}

export async function rejectLateRelaxationRequestAction(
  id: string,
  reviewNotes?: string | null,
): Promise<ActionResult> {
  const session = await requireAdminSession();
  const result = await rejectLateRelaxationRequest(session.user.id, id, reviewNotes);
  if (!result.ok) {
    return actionFailure(result);
  }
  revalidateRelaxationPaths();
  return actionSuccess();
}
