import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, userCompanyAssignments, users } from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";

export type AssignmentListItem = {
  userId: string;
  userEmail: string;
  userName: string | null;
  companyId: string;
  companyName: string;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateAssignmentInput = {
  userId: string;
  companyId: string;
};

export async function listAssignments(): Promise<ServiceSuccess<AssignmentListItem[]>> {
  const rows = await db
    .select({
      userId: userCompanyAssignments.userId,
      userEmail: users.email,
      userName: users.name,
      companyId: userCompanyAssignments.companyId,
      companyName: companies.name,
      createdAt: userCompanyAssignments.createdAt,
      updatedAt: userCompanyAssignments.updatedAt,
    })
    .from(userCompanyAssignments)
    .innerJoin(users, eq(userCompanyAssignments.userId, users.id))
    .innerJoin(companies, eq(userCompanyAssignments.companyId, companies.id))
    .orderBy(asc(companies.name), asc(users.email));

  return { ok: true, data: rows };
}

export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<ServiceFailure | ServiceSuccess<AssignmentListItem>> {
  const userId = input.userId.trim();
  const companyId = input.companyId.trim();

  if (!userId || !companyId) {
    return adminFailure(400, "INVALID_INPUT", "User and company are required.");
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return adminFailure(404, "USER_NOT_FOUND", "User not found.");
  }

  const [company] = await db.select().from(companies).where(eq(companies.id, companyId)).limit(1);
  if (!company) {
    return adminFailure(404, "COMPANY_NOT_FOUND", "Company not found.");
  }

  const [existingAssignment] = await db
    .select({ userId: userCompanyAssignments.userId })
    .from(userCompanyAssignments)
    .where(eq(userCompanyAssignments.userId, userId))
    .limit(1);
  if (existingAssignment) {
    return adminFailure(
      409,
      "ASSIGNMENT_EXISTS",
      "This user is already assigned as an accounting admin.",
    );
  }

  if (user.role === "admin") {
    return adminFailure(
      409,
      "INVALID_USER_ROLE",
      "OG admin users cannot be assigned as accounting admins.",
    );
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ role: "accounting_admin", updatedAt: now })
      .where(eq(users.id, userId));

    await tx.insert(userCompanyAssignments).values({
      userId,
      companyId,
      updatedAt: now,
    });
  });

  const [assignment] = await db
    .select({
      userId: userCompanyAssignments.userId,
      userEmail: users.email,
      userName: users.name,
      companyId: userCompanyAssignments.companyId,
      companyName: companies.name,
      createdAt: userCompanyAssignments.createdAt,
      updatedAt: userCompanyAssignments.updatedAt,
    })
    .from(userCompanyAssignments)
    .innerJoin(users, eq(userCompanyAssignments.userId, users.id))
    .innerJoin(companies, eq(userCompanyAssignments.companyId, companies.id))
    .where(eq(userCompanyAssignments.userId, userId))
    .limit(1);

  if (!assignment) {
    return adminFailure(500, "ASSIGNMENT_CREATE_FAILED", "Failed to load created assignment.");
  }

  return { ok: true, data: assignment };
}

export async function removeAssignment(
  userId: string,
): Promise<ServiceFailure | ServiceSuccess<void>> {
  const [assignment] = await db
    .select()
    .from(userCompanyAssignments)
    .where(eq(userCompanyAssignments.userId, userId))
    .limit(1);

  if (!assignment) {
    return adminFailure(404, "ASSIGNMENT_NOT_FOUND", "Accounting admin assignment not found.");
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.delete(userCompanyAssignments).where(eq(userCompanyAssignments.userId, userId));

    await tx
      .update(users)
      .set({ role: "employee", updatedAt: now })
      .where(and(eq(users.id, userId), eq(users.role, "accounting_admin")));
  });

  return { ok: true, data: undefined };
}
