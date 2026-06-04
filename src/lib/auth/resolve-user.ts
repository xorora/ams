import { eq } from "drizzle-orm";
import { db } from "@/db";
import { employees, users } from "@/db/schema";

type ResolveUserInput = {
  email: string;
  name?: string | null;
  image?: string | null;
  googleSubject: string;
};

export async function resolveUserOnSignIn(input: ResolveUserInput) {
  const email = input.email.toLowerCase();
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.toLowerCase();

  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const [employee] = await db.select().from(employees).where(eq(employees.email, email)).limit(1);

  if (!existingUser) {
    let role: "admin" | "employee" = "employee";

    if (bootstrapEmail && email === bootstrapEmail) {
      const [adminUser] = await db.select().from(users).where(eq(users.role, "admin")).limit(1);
      if (!adminUser) {
        role = "admin";
      }
    }

    const [createdUser] = await db
      .insert(users)
      .values({
        email,
        name: input.name ?? null,
        image: input.image ?? null,
        googleSubject: input.googleSubject,
        role,
        employeeId: employee?.id ?? null,
      })
      .returning();

    if (employee && !employee.userId) {
      await db
        .update(employees)
        .set({ userId: createdUser.id, updatedAt: new Date() })
        .where(eq(employees.id, employee.id));
    }

    return createdUser;
  }

  const [updatedUser] = await db
    .update(users)
    .set({
      name: input.name ?? existingUser.name,
      image: input.image ?? existingUser.image,
      googleSubject: input.googleSubject,
      updatedAt: new Date(),
    })
    .where(eq(users.id, existingUser.id))
    .returning();

  let linkedUser = updatedUser;

  if (employee) {
    if (!employee.userId) {
      await db
        .update(employees)
        .set({ userId: updatedUser.id, updatedAt: new Date() })
        .where(eq(employees.id, employee.id));
    }

    if (!updatedUser.employeeId) {
      const [withEmployee] = await db
        .update(users)
        .set({ employeeId: employee.id, updatedAt: new Date() })
        .where(eq(users.id, updatedUser.id))
        .returning();
      linkedUser = withEmployee;
    }
  }

  return linkedUser;
}
