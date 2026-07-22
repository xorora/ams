import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employeeCompensation, employees, salarySlips } from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import { maskTransferDetails } from "./bank-mask";
import {
  computeSalaryForEmployeeMonth,
  type SlipAdjustments,
  validateYearMonth,
} from "./calculations";
import { assertCompanyScope, getEmployeeInCompany } from "./company-access";

export type SalarySlipRecord = typeof salarySlips.$inferSelect;

export type SalarySlipListItem = {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string | null;
  designation: string | null;
  companyId: string;
  companyName: string;
  yearMonth: string;
  netSalaryPkr: number;
  calculatedSalaryPkr: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SalarySlipDetail = SalarySlipListItem & {
  incomeTaxPkr: number;
  additionalDeductionPkr: number;
  deductionDetails: string | null;
  otherPayPkr: number;
  incrementPkr: number;
  otherPayableDetails: string | null;
  totalDays: number;
  earnedDays: number;
  deductDays: number;
  autoLeaveDeductionPkr: number;
  securityDeductionPkr: number;
  totalOtherPayPkr: number;
  totalDeductionPkr: number;
  transferDetails: string | null;
  createdByUserId: string;
  updatedByUserId: string | null;
};

export type SalarySlipWriteInput = {
  incomeTaxPkr?: number;
  additionalDeductionPkr?: number;
  deductionDetails?: string | null;
  otherPayPkr?: number;
  incrementPkr?: number;
  otherPayableDetails?: string | null;
};

export type CreateSalarySlipInput = SalarySlipWriteInput & {
  employeeId: string;
  yearMonth: string;
};

export type UpdateSalarySlipInput = SalarySlipWriteInput;

export type ListSalarySlipsFilters = {
  companyId?: string;
  yearMonth?: string;
  employeeId?: string;
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

function normalizeWriteInput(
  input: SalarySlipWriteInput,
): ServiceFailure | ServiceSuccess<Required<SalarySlipWriteInput>> {
  const incomeTaxPkr = input.incomeTaxPkr ?? 0;
  const incomeTaxValidated = validateNonNegativeInteger(incomeTaxPkr, "Income tax");
  if (!incomeTaxValidated.ok) {
    return incomeTaxValidated;
  }

  const additionalDeductionPkr = input.additionalDeductionPkr ?? 0;
  const additionalValidated = validateNonNegativeInteger(
    additionalDeductionPkr,
    "Additional deduction",
  );
  if (!additionalValidated.ok) {
    return additionalValidated;
  }

  const otherPayPkr = input.otherPayPkr ?? 0;
  const otherPayValidated = validateNonNegativeInteger(otherPayPkr, "Other pay");
  if (!otherPayValidated.ok) {
    return otherPayValidated;
  }

  const incrementPkr = input.incrementPkr ?? 0;
  const incrementValidated = validateNonNegativeInteger(incrementPkr, "Increment");
  if (!incrementValidated.ok) {
    return incrementValidated;
  }

  return {
    ok: true,
    data: {
      incomeTaxPkr: incomeTaxValidated.data,
      additionalDeductionPkr: additionalValidated.data,
      deductionDetails: input.deductionDetails?.trim() || null,
      otherPayPkr: otherPayValidated.data,
      incrementPkr: incrementValidated.data,
      otherPayableDetails: input.otherPayableDetails?.trim() || null,
    },
  };
}

async function loadSalarySlipDetail(
  id: string,
): Promise<ServiceFailure | ServiceSuccess<SalarySlipDetail>> {
  const [row] = await db
    .select({
      slip: salarySlips,
      employeeCode: employees.employeeCode,
      employeeName: employees.fullName,
      department: employees.department,
      designation: employees.designation,
      companyName: companies.name,
    })
    .from(salarySlips)
    .innerJoin(employees, eq(salarySlips.employeeId, employees.id))
    .innerJoin(companies, eq(salarySlips.companyId, companies.id))
    .where(eq(salarySlips.id, id))
    .limit(1);

  if (!row) {
    return adminFailure(404, "SALARY_SLIP_NOT_FOUND", "Salary slip not found.");
  }

  return {
    ok: true,
    data: mapSalarySlipDetail(row.slip, {
      employeeCode: row.employeeCode,
      employeeName: row.employeeName,
      department: row.department,
      designation: row.designation,
      companyName: row.companyName,
    }),
  };
}

function mapSalarySlipDetail(
  slip: SalarySlipRecord,
  employee: {
    employeeCode: string;
    employeeName: string;
    department: string | null;
    designation: string | null;
    companyName: string;
  },
): SalarySlipDetail {
  return {
    id: slip.id,
    employeeId: slip.employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.employeeName,
    department: employee.department,
    designation: employee.designation,
    companyId: slip.companyId,
    companyName: employee.companyName,
    yearMonth: slip.yearMonth,
    incomeTaxPkr: slip.incomeTaxPkr,
    additionalDeductionPkr: slip.additionalDeductionPkr,
    deductionDetails: slip.deductionDetails,
    otherPayPkr: slip.otherPayPkr,
    incrementPkr: slip.incrementPkr,
    otherPayableDetails: slip.otherPayableDetails,
    totalDays: slip.totalDays,
    earnedDays: slip.earnedDays,
    deductDays: slip.deductDays,
    calculatedSalaryPkr: slip.calculatedSalaryPkr,
    autoLeaveDeductionPkr: slip.autoLeaveDeductionPkr,
    securityDeductionPkr: slip.securityDeductionPkr,
    totalOtherPayPkr: slip.totalOtherPayPkr,
    totalDeductionPkr: slip.totalDeductionPkr,
    netSalaryPkr: slip.netSalaryPkr,
    transferDetails: slip.transferDetails,
    createdByUserId: slip.createdByUserId,
    updatedByUserId: slip.updatedByUserId,
    createdAt: slip.createdAt,
    updatedAt: slip.updatedAt,
  };
}

function mapSalarySlipListItem(
  slip: SalarySlipRecord,
  employee: {
    employeeCode: string;
    employeeName: string;
    department: string | null;
    designation: string | null;
    companyName: string;
  },
): SalarySlipListItem {
  return {
    id: slip.id,
    employeeId: slip.employeeId,
    employeeCode: employee.employeeCode,
    employeeName: employee.employeeName,
    department: employee.department,
    designation: employee.designation,
    companyId: slip.companyId,
    companyName: employee.companyName,
    yearMonth: slip.yearMonth,
    netSalaryPkr: slip.netSalaryPkr,
    calculatedSalaryPkr: slip.calculatedSalaryPkr,
    createdAt: slip.createdAt,
    updatedAt: slip.updatedAt,
  };
}

async function getCompensationForSlip(
  employeeId: string,
): Promise<ServiceFailure | ServiceSuccess<typeof employeeCompensation.$inferSelect>> {
  const [compensation] = await db
    .select()
    .from(employeeCompensation)
    .where(eq(employeeCompensation.employeeId, employeeId))
    .limit(1);

  if (!compensation) {
    return adminFailure(
      400,
      "COMPENSATION_REQUIRED",
      "Employee compensation profile must be configured before creating a salary slip.",
    );
  }

  return { ok: true, data: compensation };
}

async function computeSlipSnapshots(
  employeeId: string,
  yearMonth: string,
  compensation: typeof employeeCompensation.$inferSelect,
  adjustments: SlipAdjustments,
) {
  return computeSalaryForEmployeeMonth(
    employeeId,
    yearMonth,
    {
      grossSalaryPkr: compensation.grossSalaryPkr,
      fixedSecurityDeductionPkr: compensation.fixedSecurityDeductionPkr,
      fixedOtherPayPkr: compensation.fixedOtherPayPkr,
      bankName: compensation.bankName,
      bankAccountNumber: compensation.bankAccountNumber,
    },
    adjustments,
  );
}

export async function listSalarySlips(
  filters: ListSalarySlipsFilters = {},
): Promise<ServiceSuccess<SalarySlipListItem[]>> {
  const conditions = [];

  if (filters.companyId) {
    conditions.push(eq(salarySlips.companyId, filters.companyId));
  }

  if (filters.yearMonth) {
    conditions.push(eq(salarySlips.yearMonth, filters.yearMonth));
  }

  if (filters.employeeId) {
    conditions.push(eq(salarySlips.employeeId, filters.employeeId));
  }

  const rows = await db
    .select({
      slip: salarySlips,
      employeeCode: employees.employeeCode,
      employeeName: employees.fullName,
      department: employees.department,
      designation: employees.designation,
      companyName: companies.name,
    })
    .from(salarySlips)
    .innerJoin(employees, eq(salarySlips.employeeId, employees.id))
    .innerJoin(companies, eq(salarySlips.companyId, companies.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(salarySlips.yearMonth), asc(employees.fullName));

  return {
    ok: true,
    data: rows.map((row) =>
      mapSalarySlipListItem(row.slip, {
        employeeCode: row.employeeCode,
        employeeName: row.employeeName,
        department: row.department,
        designation: row.designation,
        companyName: row.companyName,
      }),
    ),
  };
}

export async function getSalarySlip(
  id: string,
  scope: { role: "admin" | "accounting_admin"; companyId: string | null },
): Promise<ServiceFailure | ServiceSuccess<SalarySlipDetail>> {
  const result = await loadSalarySlipDetail(id);
  if (!result.ok) {
    return result;
  }

  const scopeResult = assertCompanyScope(result.data.companyId, scope.companyId, scope.role);
  if (!scopeResult.ok) {
    return scopeResult;
  }

  return result;
}

export async function createSalarySlip(
  input: CreateSalarySlipInput,
  companyId: string,
  createdByUserId: string,
): Promise<ServiceFailure | ServiceSuccess<SalarySlipDetail>> {
  const employeeId = input.employeeId.trim();
  const yearMonth = input.yearMonth.trim();

  if (!employeeId) {
    return adminFailure(400, "INVALID_EMPLOYEE", "Employee is required.");
  }

  if (!validateYearMonth(yearMonth)) {
    return adminFailure(400, "INVALID_YEAR_MONTH", "yearMonth must be in YYYY-MM format.");
  }

  const employeeResult = await getEmployeeInCompany(employeeId, companyId);
  if (!employeeResult.ok) {
    return employeeResult;
  }

  const writeInput = normalizeWriteInput(input);
  if (!writeInput.ok) {
    return writeInput;
  }

  const [existing] = await db
    .select({ id: salarySlips.id })
    .from(salarySlips)
    .where(and(eq(salarySlips.employeeId, employeeId), eq(salarySlips.yearMonth, yearMonth)))
    .limit(1);

  if (existing) {
    return adminFailure(
      409,
      "DUPLICATE_SALARY_SLIP",
      "A salary slip already exists for this employee and month.",
    );
  }

  const compensationResult = await getCompensationForSlip(employeeId);
  if (!compensationResult.ok) {
    return compensationResult;
  }

  const compensation = compensationResult.data;
  const adjustments: SlipAdjustments = {
    incomeTaxPkr: writeInput.data.incomeTaxPkr,
    additionalDeductionPkr: writeInput.data.additionalDeductionPkr,
    otherPayPkr: writeInput.data.otherPayPkr,
    incrementPkr: writeInput.data.incrementPkr,
  };

  const snapshots = await computeSlipSnapshots(employeeId, yearMonth, compensation, adjustments);
  const now = new Date();

  const [created] = await db
    .insert(salarySlips)
    .values({
      employeeId,
      companyId,
      yearMonth,
      incomeTaxPkr: writeInput.data.incomeTaxPkr,
      additionalDeductionPkr: writeInput.data.additionalDeductionPkr,
      deductionDetails: writeInput.data.deductionDetails,
      otherPayPkr: writeInput.data.otherPayPkr,
      incrementPkr: writeInput.data.incrementPkr,
      otherPayableDetails: writeInput.data.otherPayableDetails,
      totalDays: snapshots.totalDays,
      earnedDays: snapshots.earnedDays,
      deductDays: snapshots.deductDays,
      calculatedSalaryPkr: snapshots.calculatedSalaryPkr,
      autoLeaveDeductionPkr: snapshots.autoLeaveDeductionPkr,
      securityDeductionPkr: snapshots.securityDeductionPkr,
      totalOtherPayPkr: snapshots.totalOtherPayPkr,
      totalDeductionPkr: snapshots.totalDeductionPkr,
      netSalaryPkr: snapshots.netSalaryPkr,
      transferDetails: snapshots.transferDetails,
      createdByUserId,
      updatedByUserId: createdByUserId,
      updatedAt: now,
    })
    .returning();

  return loadSalarySlipDetail(created.id);
}

export async function updateSalarySlip(
  id: string,
  input: UpdateSalarySlipInput,
  scope: { role: "admin" | "accounting_admin"; companyId: string | null },
  updatedByUserId: string,
): Promise<ServiceFailure | ServiceSuccess<SalarySlipDetail>> {
  const current = await loadSalarySlipDetail(id);
  if (!current.ok) {
    return current;
  }

  const scopeResult = assertCompanyScope(current.data.companyId, scope.companyId, scope.role);
  if (!scopeResult.ok) {
    return scopeResult;
  }

  const writeInput = normalizeWriteInput({
    incomeTaxPkr: input.incomeTaxPkr ?? current.data.incomeTaxPkr,
    additionalDeductionPkr: input.additionalDeductionPkr ?? current.data.additionalDeductionPkr,
    deductionDetails:
      input.deductionDetails !== undefined ? input.deductionDetails : current.data.deductionDetails,
    otherPayPkr: input.otherPayPkr ?? current.data.otherPayPkr,
    incrementPkr: input.incrementPkr ?? current.data.incrementPkr,
    otherPayableDetails:
      input.otherPayableDetails !== undefined
        ? input.otherPayableDetails
        : current.data.otherPayableDetails,
  });

  if (!writeInput.ok) {
    return writeInput;
  }

  const compensationResult = await getCompensationForSlip(current.data.employeeId);
  if (!compensationResult.ok) {
    return compensationResult;
  }

  const adjustments: SlipAdjustments = {
    incomeTaxPkr: writeInput.data.incomeTaxPkr,
    additionalDeductionPkr: writeInput.data.additionalDeductionPkr,
    otherPayPkr: writeInput.data.otherPayPkr,
    incrementPkr: writeInput.data.incrementPkr,
  };

  const snapshots = await computeSlipSnapshots(
    current.data.employeeId,
    current.data.yearMonth,
    compensationResult.data,
    adjustments,
  );

  const now = new Date();

  await db
    .update(salarySlips)
    .set({
      incomeTaxPkr: writeInput.data.incomeTaxPkr,
      additionalDeductionPkr: writeInput.data.additionalDeductionPkr,
      deductionDetails: writeInput.data.deductionDetails,
      otherPayPkr: writeInput.data.otherPayPkr,
      incrementPkr: writeInput.data.incrementPkr,
      otherPayableDetails: writeInput.data.otherPayableDetails,
      totalDays: snapshots.totalDays,
      earnedDays: snapshots.earnedDays,
      deductDays: snapshots.deductDays,
      calculatedSalaryPkr: snapshots.calculatedSalaryPkr,
      autoLeaveDeductionPkr: snapshots.autoLeaveDeductionPkr,
      securityDeductionPkr: snapshots.securityDeductionPkr,
      totalOtherPayPkr: snapshots.totalOtherPayPkr,
      totalDeductionPkr: snapshots.totalDeductionPkr,
      netSalaryPkr: snapshots.netSalaryPkr,
      transferDetails: snapshots.transferDetails,
      updatedByUserId,
      updatedAt: now,
    })
    .where(eq(salarySlips.id, id));

  return loadSalarySlipDetail(id);
}

/** Create or update the month slip with a new income tax amount (other fields preserved). */
export async function upsertMonthIncomeTax(
  employeeId: string,
  companyId: string,
  yearMonth: string,
  incomeTaxPkr: number,
  userId: string,
  role: "admin" | "accounting_admin" = "admin",
): Promise<ServiceFailure | ServiceSuccess<SalarySlipDetail>> {
  if (!validateYearMonth(yearMonth)) {
    return adminFailure(400, "INVALID_YEAR_MONTH", "yearMonth must be in YYYY-MM format.");
  }

  if (!Number.isInteger(incomeTaxPkr) || incomeTaxPkr < 0) {
    return adminFailure(400, "INVALID_AMOUNT", "Income tax must be a non-negative integer.");
  }

  const [existing] = await db
    .select({ id: salarySlips.id })
    .from(salarySlips)
    .where(and(eq(salarySlips.employeeId, employeeId), eq(salarySlips.yearMonth, yearMonth)))
    .limit(1);

  if (existing) {
    return updateSalarySlip(
      existing.id,
      { incomeTaxPkr },
      { role, companyId },
      userId,
    );
  }

  return createSalarySlip(
    {
      employeeId,
      yearMonth,
      incomeTaxPkr,
      additionalDeductionPkr: 0,
      otherPayPkr: 0,
      incrementPkr: 0,
    },
    companyId,
    userId,
  );
}

export async function listEmployeeSalarySlips(
  employeeId: string,
): Promise<ServiceSuccess<SalarySlipListItem[]>> {
  return listSalarySlips({ employeeId });
}

export async function getEmployeeSalarySlip(
  id: string,
  employeeId: string,
): Promise<ServiceFailure | ServiceSuccess<SalarySlipDetail>> {
  const result = await loadSalarySlipDetail(id);
  if (!result.ok) {
    return result;
  }

  if (result.data.employeeId !== employeeId) {
    return adminFailure(403, "FORBIDDEN", "You do not have access to this salary slip.");
  }

  return {
    ok: true,
    data: {
      ...result.data,
      transferDetails: maskTransferDetails(result.data.transferDetails),
    },
  };
}
