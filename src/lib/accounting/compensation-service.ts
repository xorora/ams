import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { employeeCompensation, salarySlips } from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import { listEmployees } from "@/lib/admin/employees-service";
import {
  computeSalaryForEmployeeMonth,
  type SalaryCalculationResult,
  validateYearMonth,
} from "./calculations";
import { getEmployeeInCompany } from "./company-access";
import {
  ensureCompensationStructureColumns,
  maybeImportXororaCnplCompensationOnce,
} from "./import-xorora-cnpl-compensation";

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

function emptyMonthMetrics() {
  return {
    workingDays: null as number | null,
    daysWorked: null as number | null,
    leaveDeductionPkr: null as number | null,
    earnedSalaryPkr: null as number | null,
    incomeTaxPkr: null as number | null,
    totalDeductionPkr: null as number | null,
    netSalaryPkr: null as number | null,
    salarySlipId: null as string | null,
  };
}

function mapCalcToMetrics(
  calc: SalaryCalculationResult,
  incomeTaxPkr: number,
  salarySlipId: string | null,
) {
  return {
    workingDays: calc.totalDays,
    daysWorked: calc.earnedDays,
    leaveDeductionPkr: calc.autoLeaveDeductionPkr,
    earnedSalaryPkr: calc.calculatedSalaryPkr,
    incomeTaxPkr,
    totalDeductionPkr: calc.totalDeductionPkr,
    netSalaryPkr: calc.netSalaryPkr,
    salarySlipId,
  };
}

export async function listCompensation(
  filters: ListCompensationFilters,
): Promise<ServiceSuccess<CompensationListItem[]>> {
  await ensureCompensationStructureColumns();
  await maybeImportXororaCnplCompensationOnce(filters.companyId);

  const yearMonth = filters.yearMonth?.trim();
  if (yearMonth && !validateYearMonth(yearMonth)) {
    return { ok: true, data: [] };
  }

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

  const slipByEmployeeId = new Map<
    string,
    {
      id: string;
      incomeTaxPkr: number;
      additionalDeductionPkr: number;
      otherPayPkr: number;
      incrementPkr: number;
    }
  >();

  if (yearMonth) {
    const slipRows = await db
      .select({
        id: salarySlips.id,
        employeeId: salarySlips.employeeId,
        incomeTaxPkr: salarySlips.incomeTaxPkr,
        additionalDeductionPkr: salarySlips.additionalDeductionPkr,
        otherPayPkr: salarySlips.otherPayPkr,
        incrementPkr: salarySlips.incrementPkr,
      })
      .from(salarySlips)
      .where(
        and(
          eq(salarySlips.companyId, filters.companyId),
          eq(salarySlips.yearMonth, yearMonth),
          inArray(salarySlips.employeeId, employeeIds),
        ),
      );

    for (const slip of slipRows) {
      slipByEmployeeId.set(slip.employeeId, slip);
    }
  }

  const data: CompensationListItem[] = [];

  for (const employee of employeeResult.data) {
    const compensation = compensationByEmployeeId.get(employee.id);
    const base: CompensationListItem = {
      employeeId: employee.id,
      employeeCode: employee.employeeCode,
      fullName: employee.fullName,
      department: employee.department,
      designation: employee.designation,
      joiningDate: employee.createdAt.toISOString(),
      grossSalaryPkr: compensation?.grossSalaryPkr ?? null,
      basicSalaryPkr: compensation?.basicSalaryPkr ?? null,
      conveyanceAllowancePkr: compensation?.conveyanceAllowancePkr ?? null,
      adhocPkr: compensation?.adhocPkr ?? null,
      hrAllowancePkr: compensation?.hrAllowancePkr ?? null,
      medicalAllowancePkr: compensation?.medicalAllowancePkr ?? null,
      bankName: compensation?.bankName ?? null,
      bankAccountNumber: compensation?.bankAccountNumber ?? null,
      fixedSecurityDeductionPkr: compensation?.fixedSecurityDeductionPkr ?? null,
      fixedOtherPayPkr: compensation?.fixedOtherPayPkr ?? null,
      updatedAt: compensation?.updatedAt ?? null,
      ...emptyMonthMetrics(),
    };

    if (!yearMonth || !compensation) {
      data.push(base);
      continue;
    }

    const slip = slipByEmployeeId.get(employee.id);
    const calc = await computeSalaryForEmployeeMonth(
      employee.id,
      yearMonth,
      {
        grossSalaryPkr: compensation.grossSalaryPkr,
        fixedSecurityDeductionPkr: compensation.fixedSecurityDeductionPkr,
        fixedOtherPayPkr: compensation.fixedOtherPayPkr,
        bankName: compensation.bankName,
        bankAccountNumber: compensation.bankAccountNumber,
      },
      {
        incomeTaxPkr: slip?.incomeTaxPkr ?? 0,
        additionalDeductionPkr: slip?.additionalDeductionPkr ?? 0,
        otherPayPkr: slip?.otherPayPkr ?? 0,
        incrementPkr: slip?.incrementPkr ?? 0,
      },
    );

    data.push({
      ...base,
      ...mapCalcToMetrics(calc, slip?.incomeTaxPkr ?? 0, slip?.id ?? null),
    });
  }

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
        adhocPkr: data.adhocPkr ?? 0,
        hrAllowancePkr: data.hrAllowancePkr ?? 0,
        medicalAllowancePkr: data.medicalAllowancePkr ?? 0,
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
      adhocPkr: data.adhocPkr ?? 0,
      hrAllowancePkr: data.hrAllowancePkr ?? 0,
      medicalAllowancePkr: data.medicalAllowancePkr ?? 0,
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
