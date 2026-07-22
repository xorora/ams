import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { employeeCompensation } from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import { listEmployees } from "@/lib/admin/employees-service";
import { getEmployeeInCompany } from "./company-access";
import { ensureCompensationStructureColumns, maybeImportXororaCnplCompensationOnce } from "./import-xorora-cnpl-compensation";

export type CompensationRecord = typeof employeeCompensation.$inferSelect;

export type CompensationListItem = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  designation: string | null;
  grossSalaryPkr: number | null;
  basicSalaryPkr: number | null;
  conveyanceAllowancePkr: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  fixedSecurityDeductionPkr: number | null;
  fixedOtherPayPkr: number | null;
  updatedAt: Date | null;
};

export type UpsertCompensationInput = {
  grossSalaryPkr: number;
  basicSalaryPkr?: number;
  conveyanceAllowancePkr?: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  fixedSecurityDeductionPkr?: number;
  fixedOtherPayPkr?: number;
};

export type ListCompensationFilters = {
  companyId: string;
  search?: string;
};

function validateNonNegativeInteger(
  value: number,
  field: string,
): ServiceFailure | ServiceSuccess<number> {
  if (!Number.isInteger(value) || value < 0) {
    return adminFailure(400, "INVALID_AMOUNT", `${field} must be a non-negative integer.`);
  }
  return { ok: true, data: value };
}

function validateCompensationInput(
  input: UpsertCompensationInput,
): ServiceFailure | ServiceSuccess<UpsertCompensationInput> {
  const grossValidated = validateNonNegativeInteger(input.grossSalaryPkr, "Gross monthly salary");
  if (!grossValidated.ok) {
    return grossValidated;
  }

  if (grossValidated.data <= 0) {
    return adminFailure(
      400,
      "INVALID_GROSS_SALARY",
      "Gross monthly salary must be greater than zero.",
    );
  }

  const basicValidated = validateNonNegativeInteger(input.basicSalaryPkr ?? 0, "Basic salary");
  if (!basicValidated.ok) {
    return basicValidated;
  }

  const conveyanceValidated = validateNonNegativeInteger(
    input.conveyanceAllowancePkr ?? 0,
    "Conveyance/Fuel/Food allowance",
  );
  if (!conveyanceValidated.ok) {
    return conveyanceValidated;
  }

  const securityDeduction = input.fixedSecurityDeductionPkr ?? 0;
  const securityValidated = validateNonNegativeInteger(
    securityDeduction,
    "Fixed security deduction",
  );
  if (!securityValidated.ok) {
    return securityValidated;
  }

  const otherPay = input.fixedOtherPayPkr ?? 0;
  const otherPayValidated = validateNonNegativeInteger(otherPay, "Fixed other pay");
  if (!otherPayValidated.ok) {
    return otherPayValidated;
  }

  return {
    ok: true,
    data: {
      grossSalaryPkr: grossValidated.data,
      basicSalaryPkr: basicValidated.data,
      conveyanceAllowancePkr: conveyanceValidated.data,
      bankName: input.bankName?.trim() || null,
      bankAccountNumber: input.bankAccountNumber?.trim() || null,
      fixedSecurityDeductionPkr: securityValidated.data,
      fixedOtherPayPkr: otherPayValidated.data,
    },
  };
}

export async function listCompensation(
  filters: ListCompensationFilters,
): Promise<ServiceSuccess<CompensationListItem[]>> {
  await ensureCompensationStructureColumns();
  await maybeImportXororaCnplCompensationOnce(filters.companyId);

  const employeeResult = await listEmployees({
    companyId: filters.companyId,
    search: filters.search,
    includeInactive: false,
  });

  if (employeeResult.data.length === 0) {
    return { ok: true, data: [] };
  }

  const employeeIds = employeeResult.data.map((employee) => employee.id);
  const compensationRows = await db
    .select()
    .from(employeeCompensation)
    .where(inArray(employeeCompensation.employeeId, employeeIds));

  const compensationByEmployeeId = new Map(
    compensationRows.map((row) => [row.employeeId, row]),
  );

  const data = employeeResult.data.map((employee) => {
    const compensation = compensationByEmployeeId.get(employee.id);
    return {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      department: employee.department,
      designation: employee.designation,
      grossSalaryPkr: compensation?.grossSalaryPkr ?? null,
      basicSalaryPkr: compensation?.basicSalaryPkr ?? null,
      conveyanceAllowancePkr: compensation?.conveyanceAllowancePkr ?? null,
      bankName: compensation?.bankName ?? null,
      bankAccountNumber: compensation?.bankAccountNumber ?? null,
      fixedSecurityDeductionPkr: compensation?.fixedSecurityDeductionPkr ?? null,
      fixedOtherPayPkr: compensation?.fixedOtherPayPkr ?? null,
      updatedAt: compensation?.updatedAt ?? null,
    };
  });

  return { ok: true, data };
}

export async function getCompensation(
  employeeId: string,
  companyId: string,
): Promise<ServiceFailure | ServiceSuccess<CompensationRecord>> {
  await ensureCompensationStructureColumns();

  const employeeResult = await getEmployeeInCompany(employeeId, companyId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  const [compensation] = await db
    .select()
    .from(employeeCompensation)
    .where(eq(employeeCompensation.employeeId, employeeId))
    .limit(1);

  if (!compensation) {
    return adminFailure(404, "COMPENSATION_NOT_FOUND", "Compensation profile not found.");
  }

  return { ok: true, data: compensation };
}

export async function upsertCompensation(
  employeeId: string,
  companyId: string,
  updatedByUserId: string,
  input: UpsertCompensationInput,
): Promise<ServiceFailure | ServiceSuccess<CompensationRecord>> {
  await ensureCompensationStructureColumns();

  const employeeResult = await getEmployeeInCompany(employeeId, companyId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  const validated = validateCompensationInput(input);
  if (!validated.ok) {
    return validated;
  }

  const data = validated.data;
  const now = new Date();

  const [existing] = await db
    .select({ id: employeeCompensation.id })
    .from(employeeCompensation)
    .where(eq(employeeCompensation.employeeId, employeeId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(employeeCompensation)
      .set({
        grossSalaryPkr: data.grossSalaryPkr,
        basicSalaryPkr: data.basicSalaryPkr ?? 0,
        conveyanceAllowancePkr: data.conveyanceAllowancePkr ?? 0,
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        fixedSecurityDeductionPkr: data.fixedSecurityDeductionPkr ?? 0,
        fixedOtherPayPkr: data.fixedOtherPayPkr ?? 0,
        updatedByUserId,
        updatedAt: now,
      })
      .where(eq(employeeCompensation.employeeId, employeeId))
      .returning();

    return { ok: true, data: updated };
  }

  const [created] = await db
    .insert(employeeCompensation)
    .values({
      employeeId,
      grossSalaryPkr: data.grossSalaryPkr,
      basicSalaryPkr: data.basicSalaryPkr ?? 0,
      conveyanceAllowancePkr: data.conveyanceAllowancePkr ?? 0,
      bankName: data.bankName,
      bankAccountNumber: data.bankAccountNumber,
      fixedSecurityDeductionPkr: data.fixedSecurityDeductionPkr ?? 0,
      fixedOtherPayPkr: data.fixedOtherPayPkr ?? 0,
      updatedByUserId,
      updatedAt: now,
    })
    .returning();

  return { ok: true, data: created };
}
