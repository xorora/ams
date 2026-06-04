import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireAdminSession(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "admin") {
    redirect("/dashboard");
  }
  return session;
}

/** Session with a linked employee record (admins and employees). */
export async function requireEmployeeSession(): Promise<Session> {
  const session = await requireSession();
  if (!hasLinkedEmployee(session)) {
    redirect("/dashboard");
  }
  return session;
}

type ApiAuthFailure = {
  session: null;
  response: NextResponse;
};

type ApiAuthSuccess = {
  session: Session;
  response: null;
};

export async function requireApiEmployeeSession(): Promise<ApiAuthFailure | ApiAuthSuccess> {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!hasLinkedEmployee(session)) {
    return {
      session: null,
      response: NextResponse.json(
        { error: "Forbidden", code: "EMPLOYEE_NOT_LINKED" },
        { status: 403 },
      ),
    };
  }
  return { session, response: null };
}

export async function requireApiAdminSession(): Promise<ApiAuthFailure | ApiAuthSuccess> {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (session.user.role !== "admin") {
    return {
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, response: null };
}
