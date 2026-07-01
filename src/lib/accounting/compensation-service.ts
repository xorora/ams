import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { employeeCompensation, employees } from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import { getEmployeeInCompany } from "./company-access";

export type CompensationRecord = typeof employeeCompensation.$inferSelect;

export type CompensationListItem = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  designation: string | null;
  grossSalaryPkr: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  fixedSecurityDeductionPkr: number | null;
  fixedOtherPayPkr: number | null;
  updatedAt: Date | null;
};

export type UpsertCompensationInput = {
  grossSalaryPkr: number;
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
  const grossValidated = validateNonNegativeInteger(input.grossSalaryPkr, "Gross salary");
  if (!grossValidated.ok) {
    return grossValidated;
  }

  if (grossValidated.data <= 0) {
    return adminFailure(400, "INVALID_GROSS_SALARY", "Gross salary must be greater than zero.");
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
  const conditions = [eq(employees.companyId, filters.companyId), eq(employees.isActive, true)];

  const search = filters.search?.trim();
  if (search) {
    const pattern = `%${search}%`;
    const searchCondition = or(
      ilike(employees.fullName, pattern),
      ilike(employees.employeeCode, pattern),
      ilike(employees.department, pattern),
      ilike(employees.designation, pattern),
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  const rows = await db
    .select({
      employeeId: employees.id,
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      department: employees.department,
      designation: employees.designation,
      grossSalaryPkr: employeeCompensation.grossSalaryPkr,
      bankName: employeeCompensation.bankName,
      bankAccountNumber: employeeCompensation.bankAccountNumber,
      fixedSecurityDeductionPkr: employeeCompensation.fixedSecurityDeductionPkr,
      fixedOtherPayPkr: employeeCompensation.fixedOtherPayPkr,
      updatedAt: employeeCompensation.updatedAt,
    })
    .from(employees)
    .leftJoin(employeeCompensation, eq(employeeCompensation.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(asc(employees.fullName));

  return { ok: true, data: rows };
}

export async function getCompensation(
  employeeId: string,
  companyId: string,
): Promise<ServiceFailure | ServiceSuccess<CompensationRecord>> {
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
