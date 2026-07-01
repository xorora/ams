import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { getSelectedCompanyId } from "@/lib/admin/selected-company";
import { hasLinkedEmployee } from "@/lib/auth/attendance-access";

export function isAccountingOrAdmin(session: Session): boolean {
  return session.user.role === "admin" || session.user.role === "accounting_admin";
}

export async function getAccountingCompanyId(session: Session): Promise<string | null> {
  if (session.user.role === "accounting_admin") {
    return session.user.assignedCompanyId;
  }

  if (session.user.role === "admin") {
    return getSelectedCompanyId();
  }

  return null;
}

export async function requireAccountingCompanyId(session: Session): Promise<string> {
  const companyId = await getAccountingCompanyId(session);
  if (!companyId) {
    throw new Error(
      session.user.role === "accounting_admin"
        ? "No company assignment is configured for your account."
        : "No company selected.",
    );
  }
  return companyId;
}

export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    redirect("/");
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

export async function requireAccountingOrAdminSession(): Promise<Session> {
  const session = await requireSession();
  if (!isAccountingOrAdmin(session)) {
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

export async function requireApiAccountingOrAdminSession(): Promise<
  ApiAuthFailure | ApiAuthSuccess
> {
  const session = await auth();
  if (!session?.user) {
    return {
      session: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isAccountingOrAdmin(session)) {
    return {
      session: null,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, response: null };
}
