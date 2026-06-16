"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { type ActionResult, actionFailure } from "@/lib/actions/result";
import { authenticateWithCredentials } from "@/lib/auth/credentials-auth";
import { getPostAuthRedirect } from "@/lib/auth/navigation";

export async function credentialsSignInAction(input: {
  employeeCode: string;
  email: string;
  password: string;
  name?: string;
  callbackUrl?: string;
}): Promise<ActionResult<void>> {
  let user: Awaited<ReturnType<typeof authenticateWithCredentials>>;

  try {
    user = await authenticateWithCredentials({
      employeeCode: input.employeeCode,
      email: input.email,
      password: input.password,
      name: input.name ?? null,
    });
  } catch (error) {
    return actionFailure({
      ok: false,
      message: error instanceof Error ? error.message : "Sign-in failed. Try again.",
      code: "SIGN_IN_FAILED",
    });
  }

  const result = await signIn("credentials", {
    employeeCode: input.employeeCode.trim(),
    email: input.email.trim(),
    password: input.password,
    name: input.name?.trim() ?? "",
    redirect: false,
  });

  if (result?.error) {
    return actionFailure({
      ok: false,
      message: "Invalid employee code, email, or password.",
      code: "INVALID_CREDENTIALS",
    });
  }

  redirect(
    getPostAuthRedirect({
      id: user.id,
      role: user.role,
      employeeId: user.employeeId,
      email: user.email,
      name: user.name,
    }),
  );
}
