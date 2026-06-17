"use server";

import { signIn, signOut } from "@/auth";

export async function googleSignInAction(callbackUrl: string) {
  await signIn("google", { redirectTo: callbackUrl });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
