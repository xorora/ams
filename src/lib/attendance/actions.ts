"use server";

import { revalidatePath } from "next/cache";
import {
  type ActionFailure,
  type ActionResult,
  actionFailure,
  actionSuccess,
} from "@/lib/actions/result";
import type { Coordinates } from "@/lib/attendance/coords";
import { type SerializedTodayStatus, serializeTodayStatus } from "@/lib/attendance/serialize";
import { checkIn, checkOut, endBreak, getTodayStatus, startBreak } from "@/lib/attendance/service";
import { requireEmployeeSession } from "@/lib/auth/require-session";

export type AttendanceActionPayload = {
  message: string;
  status: SerializedTodayStatus;
};

async function employeeIdFromSession(): Promise<string | ActionFailure> {
  const session = await requireEmployeeSession();
  const employeeId = session.user.employeeId;
  if (!employeeId) {
    return { ok: false, error: "Forbidden", code: "EMPLOYEE_ONLY" };
  }
  return employeeId;
}

export async function checkInAction(
  coords: Coordinates,
): Promise<ActionResult<AttendanceActionPayload>> {
  const employeeId = await employeeIdFromSession();
  if (typeof employeeId !== "string") {
    return employeeId;
  }

  const result = await checkIn(employeeId, coords);
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidatePath("/dashboard");
  return actionSuccess({
    message: result.data.message,
    status: serializeTodayStatus(result.data.status),
  });
}

export async function checkOutAction(
  coords: Coordinates,
  options?: { confirmEarlyLeave?: boolean },
): Promise<ActionResult<AttendanceActionPayload>> {
  const employeeId = await employeeIdFromSession();
  if (typeof employeeId !== "string") {
    return employeeId;
  }

  const result = await checkOut(employeeId, coords, options);
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidatePath("/dashboard");
  return actionSuccess({
    message: result.data.message,
    status: serializeTodayStatus(result.data.status),
  });
}

export async function startBreakAction(
  coords: Coordinates,
): Promise<ActionResult<AttendanceActionPayload>> {
  const employeeId = await employeeIdFromSession();
  if (typeof employeeId !== "string") {
    return employeeId;
  }

  const result = await startBreak(employeeId, coords);
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidatePath("/dashboard");
  return actionSuccess({
    message: result.data.message,
    status: serializeTodayStatus(result.data.status),
  });
}

export async function endBreakAction(
  coords: Coordinates,
): Promise<ActionResult<AttendanceActionPayload>> {
  const employeeId = await employeeIdFromSession();
  if (typeof employeeId !== "string") {
    return employeeId;
  }

  const result = await endBreak(employeeId, coords);
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidatePath("/dashboard");
  return actionSuccess({
    message: result.data.message,
    status: serializeTodayStatus(result.data.status),
  });
}

export async function loadTodayStatusAction(): Promise<ActionResult<SerializedTodayStatus>> {
  const employeeId = await employeeIdFromSession();
  if (typeof employeeId !== "string") {
    return employeeId;
  }

  const result = await getTodayStatus(employeeId);
  return actionSuccess(serializeTodayStatus(result.data));
}
