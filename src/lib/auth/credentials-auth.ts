import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees, users } from "@/db/schema";
import { defaultProbationValues } from "@/lib/admin/probation";
import { hashPassword, validatePassword, verifyPassword } from "@/lib/auth/password";

export type CredentialsAuthInput = {
  employeeCode: string;
  email: string;
  password: string;
  name?: string | null;
};

export type AuthenticatedUser = typeof users.$inferSelect;

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

async function linkUserToEmployee(userId: string, employeeId: string): Promise<void> {
  const now = new Date();
  await db.update(employees).set({ userId, updatedAt: now }).where(eq(employees.id, employeeId));
  await db.update(users).set({ employeeId, updatedAt: now }).where(eq(users.id, userId));
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

async function getDefaultCompanyId(): Promise<string> {
  const [defaultCompany] = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.slug, "xorora"))
    .limit(1);

  if (!defaultCompany) {
    throw new Error("Default company is not configured.");
  }

  return defaultCompany.id;
}

async function assertEmployeeAvailable(
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

async function linkExistingEmployee(
  employee: typeof employees.$inferSelect,
  user: typeof users.$inferSelect,
  email: string,
  passwordHash: string,
  name?: string | null,
): Promise<AuthenticatedUser> {
  await assertEmployeeAvailable(employee, user.id);

  if (user.employeeId && user.employeeId !== employee.id) {
    throw new Error("Your account is already linked to a different employee record.");
  }

  const now = new Date();
  await db
    .update(employees)
    .set({
      email,
      fullName: name?.trim() || employee.fullName,
      updatedAt: now,
    })
    .where(eq(employees.id, employee.id));

  const [updatedUser] = await db
    .update(users)
    .set({
      email,
      name: name?.trim() || user.name || displayName(email, name),
      passwordHash,
      updatedAt: now,
    })
    .where(eq(users.id, user.id))
    .returning();

  if (!employee.userId || !updatedUser.employeeId) {
    await linkUserToEmployee(updatedUser.id, employee.id);
  }

  const [linkedUser] = await db.select().from(users).where(eq(users.id, updatedUser.id)).limit(1);
  return linkedUser ?? updatedUser;
}

async function createEmployeeForUser(
  employeeCode: string,
  email: string,
  name: string,
): Promise<typeof employees.$inferSelect> {
  const [emailTaken] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.email, email))
    .limit(1);

  if (emailTaken) {
    throw new Error("This email is already linked to another employee record.");
  }

  const companyId = await getDefaultCompanyId();
  const probation = defaultProbationValues();
  const [created] = await db
    .insert(employees)
    .values({
      employeeCode,
      fullName: name,
      email,
      companyId,
      probationEnabled: probation.probationEnabled,
      probationCompleted: probation.probationCompleted,
      probationStartDate: probation.probationStartDate,
      probationPeriodMonths: probation.probationPeriodMonths,
    })
    .returning();

  return created;
}

async function createUserWithEmployee(
  employeeCode: string,
  email: string,
  passwordHash: string,
  name?: string | null,
): Promise<AuthenticatedUser> {
  const fullName = displayName(email, name);
  const role = await resolveBootstrapRole(email);
  const [employeeByCode] = await db
    .select()
    .from(employees)
    .where(eq(employees.employeeCode, employeeCode))
    .limit(1);

  if (role === "admin" && !employeeByCode) {
    const [createdUser] = await db
      .insert(users)
      .values({
        email,
        name: fullName,
        passwordHash,
        role,
      })
      .returning();

    return createdUser;
  }

  if (employeeByCode) {
    await assertEmployeeAvailable(employeeByCode, null);

    const [createdUser] = await db
      .insert(users)
      .values({
        email,
        name: fullName,
        passwordHash,
        role,
        employeeId: employeeByCode.id,
      })
      .returning();

    const now = new Date();
    await db
      .update(employees)
      .set({
        email,
        fullName: name?.trim() || employeeByCode.fullName,
        userId: createdUser.id,
        updatedAt: now,
      })
      .where(eq(employees.id, employeeByCode.id));

    return createdUser;
  }

  const employee = await createEmployeeForUser(employeeCode, email, fullName);
  const [createdUser] = await db
    .insert(users)
    .values({
      email,
      name: fullName,
      passwordHash,
      role,
      employeeId: employee.id,
    })
    .returning();

  await db
    .update(employees)
    .set({ userId: createdUser.id, updatedAt: new Date() })
    .where(eq(employees.id, employee.id));

  return createdUser;
}

export async function authenticateWithCredentials(
  input: CredentialsAuthInput,
): Promise<AuthenticatedUser> {
  const employeeCode = input.employeeCode.trim();
  const email = normalizeEmail(input.email);
  const password = input.password;

  if (!employeeCode) {
    throw new Error("Employee code is required.");
  }

  if (!email) {
    throw new Error("Email is required.");
  }

  const passwordError = validatePassword(password);
  if (passwordError) {
    throw new Error(passwordError);
  }

  const passwordHash = await hashPassword(password);
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const [employeeByCode] = await db
    .select()
    .from(employees)
    .where(eq(employees.employeeCode, employeeCode))
    .limit(1);

  if (existingUser) {
    if (!existingUser.passwordHash) {
      throw new Error("This account uses a legacy sign-in method. Contact your administrator.");
    }

    const passwordMatches = await verifyPassword(password, existingUser.passwordHash);
    if (!passwordMatches) {
      throw new Error("Invalid email or password.");
    }

    if (existingUser.role === "admin" && !employeeByCode) {
      const [updatedAdmin] = await db
        .update(users)
        .set({
          passwordHash,
          name: input.name?.trim() || existingUser.name,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updatedAdmin ?? existingUser;
    }

    if (employeeByCode) {
      return linkExistingEmployee(employeeByCode, existingUser, email, passwordHash, input.name);
    }

    const fullName = displayName(email, input.name);
    const employee = await createEmployeeForUser(employeeCode, email, fullName);
    return linkExistingEmployee(employee, existingUser, email, passwordHash, input.name);
  }

  return createUserWithEmployee(employeeCode, email, passwordHash, input.name);
}
