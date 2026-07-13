"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import {
  type AuthEmailLookupResult,
  type AuthenticatedUser,
  linkEmailToEmployee,
  loginWithPassword,
  lookupEmailForAuth,
} from "@/lib/auth/credentials-auth";
import { getPostAuthRedirect } from "@/lib/auth/navigation";

async function signInCredentialsSession(user: AuthenticatedUser, password: string): Promise<void> {
  const result = await signIn("credentials", {
    mode: "login",
    email: user.email,
    password,
    employeeCode: "",
    companyId: "",
    redirect: false,
  });

  if (result?.error) {
    throw new Error("Invalid email or password.");
  }
}

function redirectAfterAuth(user: AuthenticatedUser): never {
  redirect(
    getPostAuthRedirect({
      id: user.id,
      role: user.role,
      employeeId: user.employeeId,
      assignedCompanyId: null,
      email: user.email,
      name: user.name,
    }),
  );
}

export async function checkAuthEmailAction(
  email: string,
): Promise<ActionResult<{ next: AuthEmailLookupResult }>> {
  try {
    const next = await lookupEmailForAuth(email);
    return actionSuccess({ next });
  } catch (error) {
    return actionFailure({
      ok: false,
      message: error instanceof Error ? error.message : "Could not check email.",
      code: "EMAIL_LOOKUP_FAILED",
    });
  }
}

export async function credentialsLoginAction(input: {
  email: string;
  password: string;
  callbackUrl?: string;
}): Promise<ActionResult<void>> {
  let user: AuthenticatedUser;

  try {
    user = await loginWithPassword({
      email: input.email,
      password: input.password,
    });
  } catch (error) {
    return actionFailure({
      ok: false,
      message: error instanceof Error ? error.message : "Sign-in failed. Try again.",
      code: "SIGN_IN_FAILED",
    });
  }

  try {
    await signInCredentialsSession(user, input.password);
  } catch (error) {
    return actionFailure({
      ok: false,
      message: error instanceof Error ? error.message : "Sign-in failed. Try again.",
      code: "INVALID_CREDENTIALS",
    });
  }

  redirectAfterAuth(user);
}

export async function credentialsLinkAction(input: {
  email: string;
  password: string;
  employeeCode: string;
  companyId: string;
  callbackUrl?: string;
}): Promise<ActionResult<void>> {
  let user: AuthenticatedUser;

  try {
    user = await linkEmailToEmployee({
      email: input.email,
      password: input.password,
      employeeCode: input.employeeCode,
      companyId: input.companyId,
    });
  } catch (error) {
    return actionFailure({
      ok: false,
      message: error instanceof Error ? error.message : "Could not link account. Try again.",
      code: "LINK_FAILED",
    });
  }

  try {
    // Account is linked; establish JWT session via login (avoids running link twice).
    await signInCredentialsSession(user, input.password);
  } catch (error) {
    return actionFailure({
      ok: false,
      message: error instanceof Error ? error.message : "Sign-in failed. Try again.",
      code: "INVALID_CREDENTIALS",
    });
  }

  redirectAfterAuth(user);
}
