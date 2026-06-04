"use server";

import { redirect } from "next/navigation";
import { type ActionResult, actionFailure } from "@/lib/actions/result";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";
import { getDefaultAuthenticatedPath } from "@/lib/auth/navigation";
import { linkEmployeeByCode } from "@/lib/auth/register-employee";
import { requireSession } from "@/lib/auth/require-session";

export async function registerEmployeeAction(employeeCode: string): Promise<ActionResult<void>> {
  const session = await requireSession();

  if (session.user.role !== "employee") {
    redirect(getDefaultAuthenticatedPath(session.user.role));
  }

  if (hasLinkedEmployee(session)) {
    redirect("/dashboard");
  }

  const email = session.user.email;
  if (!email) {
    return actionFailure({
      ok: false,
      message: "Your account has no email on file.",
      code: "NO_EMAIL",
    });
  }

  const result = await linkEmployeeByCode(session.user.id, email, employeeCode);
  if (!result.ok) {
    return actionFailure(result);
  }

  redirect("/dashboard");
}
