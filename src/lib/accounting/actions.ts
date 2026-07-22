"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
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
  type SalarySheetImportResult,
  importSalarySheetFromExcel,
  reassignSalaryDataYearMonth,
} from "./salary-sheet-import-service";
import { getSyncStateValue, setSyncStateValue } from "@/lib/zktime/sync-state";
import {
  type CreateSalarySlipInput,
  createSalarySlip,
  type UpdateSalarySlipInput,
  updateSalarySlip,
  upsertMonthIncomeTax,
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
  options?: { yearMonth?: string; incomeTaxPkr?: number },
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

  if (options?.yearMonth && options.incomeTaxPkr !== undefined) {
    const role =
      scope.session.user.role === "accounting_admin" ? "accounting_admin" : "admin";
    const taxResult = await upsertMonthIncomeTax(
      employeeId,
      scope.companyId,
      options.yearMonth,
      options.incomeTaxPkr,
      scope.session.user.id,
      role,
    );
    if (!taxResult.ok) {
      return actionFailure(taxResult);
    }
  }

  revalidateAccountingPaths();
  revalidatePath(`/admin/accounting/compensation/${employeeId}`);
  return actionSuccess();
}

export async function uploadSalarySheetAction(
  formData: FormData,
): Promise<ActionResult<SalarySheetImportResult>> {
  const scope = await requireAccountingCompanyScope();
  if (scope.error) {
    return scope.error;
  }

  const yearMonthRaw = formData.get("yearMonth");
  const yearMonth = typeof yearMonthRaw === "string" ? yearMonthRaw.trim() : "";
  if (!validateYearMonth(yearMonth)) {
    return actionFailure({
      ok: false,
      message: "Month must be in YYYY-MM format.",
      code: "INVALID_YEAR_MONTH",
    });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return actionFailure({
      ok: false,
      message: "Please choose an Excel (.xlsx) salary sheet to upload.",
      code: "MISSING_FILE",
    });
  }

  const fileName = file.name?.trim() || "salary-sheet.xlsx";
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    return actionFailure({
      ok: false,
      message: "Only .xlsx Excel files are supported.",
      code: "INVALID_FILE_TYPE",
    });
  }

  const maxBytes = 8 * 1024 * 1024;
  if (file.size <= 0 || file.size > maxBytes) {
    return actionFailure({
      ok: false,
      message: "File must be between 1 byte and 8 MB.",
      code: "INVALID_FILE_SIZE",
    });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await importSalarySheetFromExcel({
    companyId: scope.companyId,
    yearMonth,
    fileName,
    buffer,
    uploadedByUserId: scope.session.user.id,
  });

  if (!result.ok) {
    return actionFailure(result);
  }

  revalidateAccountingPaths();
  return actionSuccess(result.data);
}

const REASSIGN_JULY_TO_JUNE_2026_KEY = "reassign_salary_2026_07_to_2026_06_v1";

/** One-shot: payroll sheet was uploaded as July but belongs to June 2026. */
export async function maybeReassignJuly2026SalaryToJuneOnce(): Promise<void> {
  const done = await getSyncStateValue(REASSIGN_JULY_TO_JUNE_2026_KEY);
  if (done) {
    return;
  }
  await reassignSalaryDataYearMonth("2026-07", "2026-06");
  await setSyncStateValue(REASSIGN_JULY_TO_JUNE_2026_KEY, new Date().toISOString());
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
