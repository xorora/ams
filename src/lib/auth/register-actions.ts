"use server";

import { redirect } from "next/navigation";
import { type ActionResult, actionFailure } from "@/lib/actions/result";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";
import { getDefaultAuthenticatedPath } from "@/lib/auth/navigation";
import { registerEmployee } from "@/lib/auth/register-employee";
import { requireSession } from "@/lib/auth/require-session";

export async function registerEmployeeAction(input: {
  employeeCode: string;
  companyId: string;
}): Promise<ActionResult<void>> {
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

  const result = await registerEmployee(
    session.user.id,
    email,
    input.employeeCode,
    input.companyId,
  );
  if (!result.ok) {
    return actionFailure(result);
  }

  if (result.data.created) {
    const params = new URLSearchParams({ newEmployeeCode: result.data.employee.employeeCode });
    redirect(`/dashboard?${params.toString()}`);
  }

  redirect("/dashboard");
}
