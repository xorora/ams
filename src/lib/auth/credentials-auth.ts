import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, users } from "@/db/schema";
import { findEmployeeByCodeVariants } from "@/lib/admin/employee-identity";
import { linkUserToEmployeeRecord } from "@/lib/auth/employee-link";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";

export type AuthenticatedUser = typeof users.$inferSelect;

export type AuthEmailLookupResult = "password" | "link";

export type LoginWithPasswordInput = {
  email: string;
  password: string;
};

export type LinkEmailToEmployeeInput = {
  email: string;
  password: string;
  employeeCode: string;
  companyId: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function displayName(email: string, name?: string | null): string {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed;
  }
  return email.split("@")[0]?.trim() || "Employee";
}

async function resolveBootstrapRole(email: string): Promise<"admin" | "employee"> {
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  if (!bootstrapEmail || email !== bootstrapEmail) {
    return "employee";
  }

  const [adminUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);
  return adminUser ? "employee" : "admin";
}

async function resolveActiveCompanyId(companyId: string): Promise<string | null> {
  const [company] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(and(eq(companies.id, companyId), eq(companies.isActive, true)))
    .limit(1);

  return company?.id ?? null;
}

async function assertEmployeeAvailableForLink(
  employee: typeof employees.$inferSelect,
  userId: string | null,
): Promise<void> {
  if (!employee.isActive) {
    throw new Error("This employee record is deactivated. Contact your administrator.");
  }

  if (employee.userId && employee.userId !== userId) {
    throw new Error("This employee code is already linked to another account.");
  }
}

/**
 * Decide whether the email should go to password login or first-time linkage.
 * Linked = users row exists with employeeId set.
 */
export async function lookupEmailForAuth(email: string): Promise<AuthEmailLookupResult> {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    throw new Error("Email is required.");
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);

  if (existingUser?.employeeId) {
    return "password";
  }

  // Admins / accounting admins without an employee still use password login once they have an account.
  if (existingUser && existingUser.role !== "employee") {
    return "password";
  }

  return "link";
}

export async function loginWithPassword(input: LoginWithPasswordInput): Promise<AuthenticatedUser> {
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!email) {
    throw new Error("Email is required.");
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!existingUser) {
    throw new Error("Invalid email or password.");
  }

  if (!existingUser.passwordHash) {
    throw new Error(
      "This account uses Google sign-in and has no password yet. Sign in with Google, or ask an administrator to set a password.",
    );
  }

  const passwordMatches = await verifyPassword(password, existingUser.passwordHash);
  if (!passwordMatches) {
    throw new Error("Invalid email or password.");
  }

  const canLoginWithoutEmployee =
    existingUser.role === "admin" || existingUser.role === "accounting_admin";

  if (!existingUser.employeeId && !canLoginWithoutEmployee) {
    throw new Error("Your account is not linked to an employee. Contact your administrator.");
  }

  // Re-hash on successful login to keep bcrypt cost current.
  const passwordHash = await hashPassword(password);
  const [updatedUser] = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, existingUser.id))
    .returning();

  return updatedUser ?? existingUser;
}

export async function linkEmailToEmployee(
  input: LinkEmailToEmployeeInput,
): Promise<AuthenticatedUser> {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const employeeCode = input.employeeCode.trim();
  const companyId = input.companyId.trim();

  if (!email) {
    throw new Error("Email is required.");
  }
  if (!employeeCode) {
    throw new Error("Employee code is required.");
  }
  if (!companyId) {
    throw new Error("Company is required.");
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const activeCompanyId = await resolveActiveCompanyId(companyId);
  if (!activeCompanyId) {
    throw new Error("Select a valid company.");
  }

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (existingUser?.employeeId) {
    throw new Error("This email is already linked to an employee. Sign in with your password.");
  }

  const employee = await findEmployeeByCodeVariants(employeeCode);
  if (!employee) {
    throw new Error(
      "No employee found for that code. Employees must be created by an administrator.",
    );
  }

  if (employee.companyId !== activeCompanyId) {
    throw new Error("That employee code does not belong to the selected company.");
  }

  await assertEmployeeAvailableForLink(employee, existingUser?.id ?? null);

  // Ensure the login email is not already owned by a different employee record.
  const [emailOnOtherEmployee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);

  if (emailOnOtherEmployee && emailOnOtherEmployee.id !== employee.id) {
    throw new Error("This email is already linked to another employee record.");
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const fullName = displayName(email, existingUser?.name ?? employee.fullName);

  await db
    .update(employees)
    .set({
      email,
      fullName: existingUser?.name?.trim() || employee.fullName,
      updatedAt: now,
    })
    .where(eq(employees.id, employee.id));

  let user: AuthenticatedUser;

  if (existingUser) {
    const [updatedUser] = await db
      .update(users)
      .set({
        email,
        name: existingUser.name?.trim() || fullName,
        passwordHash,
        updatedAt: now,
      })
      .where(eq(users.id, existingUser.id))
      .returning();

    user = updatedUser ?? existingUser;
  } else {
    const role = await resolveBootstrapRole(email);
    const [createdUser] = await db
      .insert(users)
      .values({
        email,
        name: fullName,
        passwordHash,
        role,
      })
      .returning();

    user = createdUser;
  }

  await linkUserToEmployeeRecord(user.id, employee.id);

  const [linkedUser] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  return linkedUser ?? user;
}

/** Auth.js Credentials authorize entrypoint. */
export async function authenticateWithCredentials(input: {
  mode: "login" | "link";
  email: string;
  password: string;
  employeeCode?: string;
  companyId?: string;
}): Promise<AuthenticatedUser> {
  if (input.mode === "login") {
    return loginWithPassword({ email: input.email, password: input.password });
  }

  if (!input.employeeCode || !input.companyId) {
    throw new Error("Employee code and company are required to link your account.");
  }

  return linkEmailToEmployee({
    email: input.email,
    password: input.password,
    employeeCode: input.employeeCode,
    companyId: input.companyId,
  });
}
