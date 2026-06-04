import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";

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

export async function requireEmployeeSession(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "employee" || !session.user.employeeId) {
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
  if (session.user.role !== "employee" || !session.user.employeeId) {
    return {
      session: null,
      response: NextResponse.json({ error: "Forbidden", code: "EMPLOYEE_ONLY" }, { status: 403 }),
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
