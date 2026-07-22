"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { companies, users } from "@/db/schema";
import { type ActionResult, actionFailure, actionSuccess } from "@/lib/actions/result";
import {
  getAccountingCompanyId,
  requireAccountingOrAdminSession,
  requireAdminSession,
} from "@/lib/auth/require-session";
import {
  type CreateAssignmentInput,
  createAssignment,
  removeAssignment,
} from "./assignments-service";
import {
  computeSalaryForEmployeeMonth,
  type SalaryCalculationResult,
  validateYearMonth,
} from "./calculations";
import {
  getCompensation,
  type UpsertCompensationInput,
  upsertCompensation,
} from "./compensation-service";
import {
  type ImportXororaCnplResult,
  importXororaCnplCompensation,
} from "./import-xorora-cnpl-compensation";
import {
  type CreateSalarySlipInput,
  createSalarySlip,
  type UpdateSalarySlipInput,
  updateSalarySlip,
} from "./salary-slip-service";

function revalidateAccountingPaths() {
  revalidatePath("/admin/accounting/salary-slips");
  revalidatePath("/admin/accounting/compensation");
  revalidatePath("/admin/accounting/admins");
}

async function requireAccountingCompanyScope() {
  const session = await requireAccountingOrAdminSession();
  const companyId = await getAccountingCompanyId(session);
  if (!companyId) {
    return {
      session,
      companyId: null as string | null,
      error: actionFailure({
        ok: false,
        message:
          session.user.role === "accounting_admin"
            ? "No company assignment is configured for your account."
            : "No company selected.",
        code: "NO_COMPANY",
      }),
    };
  }
  return { session, companyId, error: null };
}

export async function upsertCompensationAction(
  employeeId: string,
  input: UpsertCompensationInput,
): Promise<ActionResult> {
  const scope = await requireAccountingCompanyScope();
  if (scope.error) {
    return scope.error;
  }

  const result = await upsertCompensation(
    employeeId,
    scope.companyId,
    scope.session.user.id,
    input,
  );
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidateAccountingPaths();
  revalidatePath(`/admin/accounting/compensation/${employeeId}`);
  return actionSuccess();
}

export async function importXororaCnplCompensationAction(): Promise<
  ActionResult<ImportXororaCnplResult>
> {
  await requireAdminSession();
  const scope = await requireAccountingCompanyScope();
  if (scope.error) {
    return scope.error;
  }

  const [selected] = await db
    .select({ slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, scope.companyId))
    .limit(1);

  if (!selected || selected.slug !== "xorora") {
    return actionFailure({
      ok: false,
      message: "CNPL compensation import is only available for the Xorora company.",
      code: "WRONG_COMPANY",
    });
  }

  try {
    const result = await importXororaCnplCompensation();
    revalidateAccountingPaths();
    return actionSuccess(result);
  } catch (error) {
    return actionFailure({
      ok: false,
      message: error instanceof Error ? error.message : "Import failed.",
      code: "IMPORT_FAILED",
    });
  }
}

export type SalarySlipPreviewInput = {
  employeeId: string;
  yearMonth: string;
  incomeTaxPkr?: number;
  additionalDeductionPkr?: number;
  otherPayPkr?: number;
  incrementPkr?: number;
};

export async function previewSalarySlipAction(
  input: SalarySlipPreviewInput,
): Promise<ActionResult<SalaryCalculationResult>> {
  const scope = await requireAccountingCompanyScope();
  if (scope.error) {
    return scope.error;
  }

  if (!validateYearMonth(input.yearMonth)) {
    return actionFailure({
      ok: false,
      message: "Month must be in YYYY-MM format.",
      code: "INVALID_YEAR_MONTH",
    });
  }

  const compensationResult = await getCompensation(input.employeeId, scope.companyId);
  if (!compensationResult.ok) {
    return actionFailure(compensationResult);
  }

  const compensation = compensationResult.data;
  const preview = await computeSalaryForEmployeeMonth(
    input.employeeId,
    input.yearMonth,
    {
      grossSalaryPkr: compensation.grossSalaryPkr,
      fixedSecurityDeductionPkr: compensation.fixedSecurityDeductionPkr,
      fixedOtherPayPkr: compensation.fixedOtherPayPkr,
      bankName: compensation.bankName,
      bankAccountNumber: compensation.bankAccountNumber,
    },
    {
      incomeTaxPkr: input.incomeTaxPkr ?? 0,
      additionalDeductionPkr: input.additionalDeductionPkr ?? 0,
      otherPayPkr: input.otherPayPkr ?? 0,
      incrementPkr: input.incrementPkr ?? 0,
    },
  );

  return actionSuccess(preview);
}

export async function createSalarySlipAction(
  input: CreateSalarySlipInput,
): Promise<ActionResult<{ id: string }>> {
  const scope = await requireAccountingCompanyScope();
  if (scope.error) {
    return scope.error;
  }

  const result = await createSalarySlip(input, scope.companyId, scope.session.user.id);
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidateAccountingPaths();
  revalidatePath(`/admin/accounting/salary-slips/${result.data.id}`);
  return actionSuccess({ id: result.data.id });
}

export async function updateSalarySlipAction(
  id: string,
  input: UpdateSalarySlipInput,
): Promise<ActionResult> {
  const scope = await requireAccountingCompanyScope();
  if (scope.error) {
    return scope.error;
  }

  const result = await updateSalarySlip(
    id,
    input,
    {
      role: scope.session.user.role as "admin" | "accounting_admin",
      companyId: scope.session.user.role === "accounting_admin" ? scope.companyId : null,
    },
    scope.session.user.id,
  );
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidateAccountingPaths();
  revalidatePath(`/admin/accounting/salary-slips/${id}`);
  return actionSuccess();
}

export async function createAccountingAssignmentAction(
  input: CreateAssignmentInput,
): Promise<ActionResult> {
  await requireAdminSession();
  const result = await createAssignment(input);
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidateAccountingPaths();
  return actionSuccess();
}

export async function createAccountingAssignmentByEmailAction(input: {
  email: string;
  companyId: string;
}): Promise<ActionResult> {
  await requireAdminSession();

  const email = input.email.trim().toLowerCase();
  if (!email) {
    return actionFailure({
      ok: false,
      message: "Email is required.",
      code: "INVALID_INPUT",
    });
  }

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    return actionFailure({
      ok: false,
      message: "No user found with that email.",
      code: "USER_NOT_FOUND",
    });
  }

  return createAccountingAssignmentAction({
    userId: user.id,
    companyId: input.companyId,
  });
}

export async function removeAccountingAssignmentAction(userId: string): Promise<ActionResult> {
  await requireAdminSession();
  const result = await removeAssignment(userId);
  if (!result.ok) {
    return actionFailure(result);
  }

  revalidateAccountingPaths();
  return actionSuccess();
}
