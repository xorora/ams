import { and, asc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { employeeCompensation, employees, salarySheetRows } from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import { getEmployeeInCompany } from "./company-access";
import { validateYearMonth } from "./calculations";
import { ensureCompensationStructureColumns } from "./import-xorora-cnpl-compensation";
import { ensureSalarySheetTables } from "./ensure-salary-sheet-tables";
import { hasSalarySheetImport } from "./salary-sheet-import-service";

export type CompensationRecord = typeof employeeCompensation.$inferSelect;

export type CompensationListItem = {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  department: string | null;
  designation: string | null;
  joiningDate: string;
  grossSalaryPkr: number | null;
  basicSalaryPkr: number | null;
  conveyanceAllowancePkr: number | null;
  adhocPkr: number | null;
  hrAllowancePkr: number | null;
  medicalAllowancePkr: number | null;
  bankName: string | null;
  bankAccountNumber: string | null;
  fixedSecurityDeductionPkr: number | null;
  fixedOtherPayPkr: number | null;
  updatedAt: Date | null;
  workingDays: number | null;
  daysWorked: number | null;
  leaveDeductionPkr: number | null;
  earnedSalaryPkr: number | null;
  incomeTaxPkr: number | null;
  totalDeductionPkr: number | null;
  netSalaryPkr: number | null;
  salarySlipId: string | null;
};

export type UpsertCompensationInput = {
  grossSalaryPkr: number;
  basicSalaryPkr?: number;
  conveyanceAllowancePkr?: number;
  adhocPkr?: number;
  hrAllowancePkr?: number;
  medicalAllowancePkr?: number;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  fixedSecurityDeductionPkr?: number;
  fixedOtherPayPkr?: number;
};

export type ListCompensationFilters = {
  companyId: string;
  search?: string;
  yearMonth?: string;
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

  const adhocValidated = validateNonNegativeInteger(input.adhocPkr ?? 0, "ADHOC");
  if (!adhocValidated.ok) {
    return adhocValidated;
  }

  const hrValidated = validateNonNegativeInteger(input.hrAllowancePkr ?? 0, "HR allowance");
  if (!hrValidated.ok) {
    return hrValidated;
  }

  const medicalValidated = validateNonNegativeInteger(
    input.medicalAllowancePkr ?? 0,
    "Medical allowance",
  );
  if (!medicalValidated.ok) {
    return medicalValidated;
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
      adhocPkr: adhocValidated.data,
      hrAllowancePkr: hrValidated.data,
      medicalAllowancePkr: medicalValidated.data,
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
  await ensureSalarySheetTables();

  const yearMonth = filters.yearMonth?.trim();
  if (!yearMonth || !validateYearMonth(yearMonth)) {
    return { ok: true, data: [] };
  }

  const hasImport = await hasSalarySheetImport(filters.companyId, yearMonth);
  if (!hasImport) {
    return { ok: true, data: [] };
  }

  const search = filters.search?.trim();
  const conditions = [
    eq(salarySheetRows.companyId, filters.companyId),
    eq(salarySheetRows.yearMonth, yearMonth),
  ];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(salarySheetRows.employeeName, pattern),
        ilike(salarySheetRows.employeeCode, pattern),
        ilike(salarySheetRows.designation, pattern),
        ilike(employees.department, pattern),
      )!,
    );
  }

  const rows = await db
    .select({
      row: salarySheetRows,
      department: employees.department,
      bankName: employeeCompensation.bankName,
      bankAccountNumber: employeeCompensation.bankAccountNumber,
      fixedSecurityDeductionPkr: employeeCompensation.fixedSecurityDeductionPkr,
      fixedOtherPayPkr: employeeCompensation.fixedOtherPayPkr,
      compensationUpdatedAt: employeeCompensation.updatedAt,
      employeeCreatedAt: employees.createdAt,
    })
    .from(salarySheetRows)
    .innerJoin(employees, eq(salarySheetRows.employeeId, employees.id))
    .leftJoin(employeeCompensation, eq(employeeCompensation.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(asc(salarySheetRows.employeeName));

  const data: CompensationListItem[] = rows.map(({ row, department, ...rest }) => ({
    employeeId: row.employeeId,
    employeeCode: row.employeeCode,
    fullName: row.employeeName,
    department: department ?? null,
    designation: row.designation,
    joiningDate: row.joiningDate ?? rest.employeeCreatedAt.toISOString(),
    grossSalaryPkr: row.grossSalaryPkr,
    basicSalaryPkr: row.basicSalaryPkr,
    conveyanceAllowancePkr: row.conveyanceAllowancePkr,
    adhocPkr: row.adhocPkr,
    hrAllowancePkr: row.hrAllowancePkr,
    medicalAllowancePkr: row.medicalAllowancePkr,
    bankName: rest.bankName ?? null,
    bankAccountNumber: rest.bankAccountNumber ?? null,
    fixedSecurityDeductionPkr: rest.fixedSecurityDeductionPkr ?? null,
    fixedOtherPayPkr: rest.fixedOtherPayPkr ?? null,
    updatedAt: rest.compensationUpdatedAt ?? null,
    workingDays: row.workingDays,
    daysWorked: row.daysWorked,
    leaveDeductionPkr: row.leaveDeductionPkr,
    earnedSalaryPkr: row.earnedSalaryPkr,
    incomeTaxPkr: row.incomeTaxPkr,
    totalDeductionPkr: row.totalDeductionPkr,
    netSalaryPkr: row.netSalaryPkr,
    salarySlipId: row.salarySlipId,
  }));

  return { ok: true, data };
}

export { hasSalarySheetImport };

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

  const now = new Date();
  const [existing] = await db
    .select()
    .from(employeeCompensation)
    .where(eq(employeeCompensation.employeeId, employeeId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(employeeCompensation)
      .set({
        ...validated.data,
        updatedByUserId,
        updatedAt: now,
      })
      .where(eq(employeeCompensation.id, existing.id))
      .returning();
    return { ok: true, data: updated };
  }

  const [created] = await db
    .insert(employeeCompensation)
    .values({
      employeeId,
      ...validated.data,
      updatedByUserId,
      updatedAt: now,
    })
    .returning();

  return { ok: true, data: created };
}

/** Used by salary-slips page employee picker — list profiles without requiring a sheet import. */
export async function listCompensationProfiles(filters: {
  companyId: string;
  search?: string;
}): Promise<ServiceSuccess<CompensationListItem[]>> {
  await ensureCompensationStructureColumns();

  const search = filters.search?.trim();
  const conditions = [eq(employees.companyId, filters.companyId), eq(employees.isActive, true)];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        ilike(employees.fullName, pattern),
        ilike(employees.employeeCode, pattern),
        ilike(employees.department, pattern),
        ilike(employees.designation, pattern),
      )!,
    );
  }

  const rows = await db
    .select({
      employee: employees,
      compensation: employeeCompensation,
    })
    .from(employees)
    .innerJoin(employeeCompensation, eq(employeeCompensation.employeeId, employees.id))
    .where(and(...conditions))
    .orderBy(asc(employees.fullName));

  const data: CompensationListItem[] = rows.map(({ employee, compensation }) => ({
    employeeId: employee.id,
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    department: employee.department,
    designation: employee.designation,
    joiningDate: employee.createdAt.toISOString(),
    grossSalaryPkr: compensation.grossSalaryPkr,
    basicSalaryPkr: compensation.basicSalaryPkr,
    conveyanceAllowancePkr: compensation.conveyanceAllowancePkr,
    adhocPkr: compensation.adhocPkr,
    hrAllowancePkr: compensation.hrAllowancePkr,
    medicalAllowancePkr: compensation.medicalAllowancePkr,
    bankName: compensation.bankName,
    bankAccountNumber: compensation.bankAccountNumber,
    fixedSecurityDeductionPkr: compensation.fixedSecurityDeductionPkr,
    fixedOtherPayPkr: compensation.fixedOtherPayPkr,
    updatedAt: compensation.updatedAt,
    workingDays: null,
    daysWorked: null,
    leaveDeductionPkr: null,
    earnedSalaryPkr: null,
    incomeTaxPkr: null,
    totalDeductionPkr: null,
    netSalaryPkr: null,
    salarySlipId: null,
  }));

  return { ok: true, data };
}
