import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  employeeCompensation,
  employees,
  salarySheetImports,
  salarySheetRows,
} from "@/db/schema";
import { adminFailure, type ServiceFailure, type ServiceSuccess } from "@/lib/admin/types";
import { validateYearMonth } from "./calculations";
import {
  ensureCompensationStructureColumns,
  normalizeCompensationName,
  XORORA_CNPL_COMPENSATION_ROWS,
} from "./import-xorora-cnpl-compensation";
import { ensureSalarySheetTables } from "./ensure-salary-sheet-tables";
import {
  parseCnplSalarySheetBuffer,
  type ParsedCnplSalaryRow,
} from "./parse-cnpl-salary-sheet";
import { createOrReplaceSalarySlipFromSheet } from "./salary-slip-service";

export type SalarySheetImportResult = {
  sheetName: string;
  yearMonth: string;
  imported: number;
  unmatched: string[];
  slipsCreated: number;
  slipsUpdated: number;
};

type EmployeeMatchRow = {
  id: string;
  fullName: string;
  employeeCode: string;
  isActive: boolean;
  designation: string | null;
  createdAt: Date;
};

function buildNameAliasLookup(): Map<string, string[]> {
  const lookup = new Map<string, string[]>();
  for (const row of XORORA_CNPL_COMPENSATION_ROWS) {
    const keys = [row.name, ...(row.aliases ?? [])].map(normalizeCompensationName);
    for (const key of keys) {
      lookup.set(key, keys);
    }
  }
  return lookup;
}

const NAME_ALIAS_LOOKUP = buildNameAliasLookup();

function formatTransferDetails(
  bankName?: string | null,
  bankAccountNumber?: string | null,
): string | null {
  const name = bankName?.trim();
  const account = bankAccountNumber?.trim();
  if (name && account) {
    return `${name} - ${account}`;
  }
  if (name) {
    return name;
  }
  if (account) {
    return account;
  }
  return null;
}

function matchEmployee(
  row: ParsedCnplSalaryRow,
  byCode: Map<string, EmployeeMatchRow>,
  byName: Map<string, EmployeeMatchRow>,
): EmployeeMatchRow | undefined {
  // Prefer name match: CNPL "Code" is usually a sheet serial (1,2,3…), not AMS employeeCode.
  const nameKey = normalizeCompensationName(row.name);
  const direct = byName.get(nameKey);
  if (direct) {
    return direct;
  }

  const aliases = NAME_ALIAS_LOOKUP.get(nameKey) ?? [];
  for (const alias of aliases) {
    const matched = byName.get(alias);
    if (matched) {
      return matched;
    }
  }

  const codeKey = row.excelCode.trim().toLowerCase();
  // Only treat non-pure-serial codes as AMS employee codes (e.g. XOR-007).
  if (codeKey && !/^\d+$/.test(codeKey)) {
    const byExactCode = byCode.get(codeKey);
    if (byExactCode) {
      return byExactCode;
    }
  }

  return undefined;
}

async function upsertCompensationFromSheet(
  employeeId: string,
  row: ParsedCnplSalaryRow,
  updatedByUserId: string,
  now: Date,
) {
  const [existing] = await db
    .select({ id: employeeCompensation.id })
    .from(employeeCompensation)
    .where(eq(employeeCompensation.employeeId, employeeId))
    .limit(1);

  if (existing) {
    await db
      .update(employeeCompensation)
      .set({
        grossSalaryPkr: row.grossSalaryPkr || row.earnedSalaryPkr + row.leaveDeductionPkr,
        basicSalaryPkr: row.basicSalaryPkr,
        conveyanceAllowancePkr: row.conveyanceAllowancePkr,
        adhocPkr: row.adhocPkr,
        hrAllowancePkr: row.hrAllowancePkr,
        medicalAllowancePkr: row.medicalAllowancePkr,
        updatedByUserId,
        updatedAt: now,
      })
      .where(eq(employeeCompensation.id, existing.id));
    return;
  }

  await db.insert(employeeCompensation).values({
    employeeId,
    grossSalaryPkr: row.grossSalaryPkr || row.earnedSalaryPkr + row.leaveDeductionPkr,
    basicSalaryPkr: row.basicSalaryPkr,
    conveyanceAllowancePkr: row.conveyanceAllowancePkr,
    adhocPkr: row.adhocPkr,
    hrAllowancePkr: row.hrAllowancePkr,
    medicalAllowancePkr: row.medicalAllowancePkr,
    bankName: null,
    bankAccountNumber: null,
    fixedSecurityDeductionPkr: 0,
    fixedOtherPayPkr: 0,
    updatedByUserId,
    updatedAt: now,
  });
}

export async function hasSalarySheetImport(
  companyId: string,
  yearMonth: string,
): Promise<boolean> {
  await ensureSalarySheetTables();
  if (!validateYearMonth(yearMonth)) {
    return false;
  }
  const [row] = await db
    .select({ id: salarySheetImports.id })
    .from(salarySheetImports)
    .where(
      and(eq(salarySheetImports.companyId, companyId), eq(salarySheetImports.yearMonth, yearMonth)),
    )
    .limit(1);
  return Boolean(row);
}

export async function importSalarySheetFromExcel(input: {
  companyId: string;
  yearMonth: string;
  fileName: string;
  buffer: Buffer;
  uploadedByUserId: string;
}): Promise<ServiceFailure | ServiceSuccess<SalarySheetImportResult>> {
  await ensureCompensationStructureColumns();
  await ensureSalarySheetTables();

  const yearMonth = input.yearMonth.trim();
  if (!validateYearMonth(yearMonth)) {
    return adminFailure(400, "INVALID_YEAR_MONTH", "yearMonth must be in YYYY-MM format.");
  }

  let parsed;
  try {
    parsed = await parseCnplSalarySheetBuffer(input.buffer);
  } catch (error) {
    return adminFailure(
      400,
      "INVALID_SALARY_SHEET",
      error instanceof Error ? error.message : "Failed to parse salary sheet.",
    );
  }

  if (parsed.rows.length === 0) {
    return adminFailure(400, "EMPTY_SALARY_SHEET", "Salary sheet has no employee rows.");
  }

  const employeeRows = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      employeeCode: employees.employeeCode,
      isActive: employees.isActive,
      designation: employees.designation,
      createdAt: employees.createdAt,
    })
    .from(employees)
    .where(eq(employees.companyId, input.companyId));

  const sorted = [...employeeRows].sort((a, b) => Number(b.isActive) - Number(a.isActive));
  const byCode = new Map<string, EmployeeMatchRow>();
  const byName = new Map<string, EmployeeMatchRow>();
  for (const employee of sorted) {
    byCode.set(employee.employeeCode.trim().toLowerCase(), employee);
    const nameKey = normalizeCompensationName(employee.fullName);
    if (!byName.has(nameKey)) {
      byName.set(nameKey, employee);
    }
  }

  const unmatched: string[] = [];
  const matchedByEmployeeId = new Map<
    string,
    { employee: EmployeeMatchRow; row: ParsedCnplSalaryRow }
  >();
  for (const row of parsed.rows) {
    const employee = matchEmployee(row, byCode, byName);
    if (!employee) {
      unmatched.push(row.name);
      continue;
    }
    // Last Excel row wins if multiple sheet lines resolve to the same employee.
    matchedByEmployeeId.set(employee.id, { employee, row });
  }

  const matched = [...matchedByEmployeeId.values()];

  if (matched.length === 0) {
    return adminFailure(
      400,
      "NO_MATCHED_EMPLOYEES",
      `No employees matched. Unmatched: ${unmatched.join(", ") || "none"}.`,
    );
  }

  const now = new Date();

  // Clear month data explicitly (do not rely only on import FK cascade).
  await db
    .delete(salarySheetRows)
    .where(
      and(
        eq(salarySheetRows.companyId, input.companyId),
        eq(salarySheetRows.yearMonth, yearMonth),
      ),
    );
  await db
    .delete(salarySheetImports)
    .where(
      and(
        eq(salarySheetImports.companyId, input.companyId),
        eq(salarySheetImports.yearMonth, yearMonth),
      ),
    );

  const [importRow] = await db
    .insert(salarySheetImports)
    .values({
      companyId: input.companyId,
      yearMonth,
      fileName: input.fileName,
      uploadedByUserId: input.uploadedByUserId,
      uploadedAt: now,
    })
    .returning();

  let slipsCreated = 0;
  let slipsUpdated = 0;
  let imported = 0;

  for (const { employee, row } of matched) {
    await upsertCompensationFromSheet(employee.id, row, input.uploadedByUserId, now);

    const [compensation] = await db
      .select({
        fixedSecurityDeductionPkr: employeeCompensation.fixedSecurityDeductionPkr,
        fixedOtherPayPkr: employeeCompensation.fixedOtherPayPkr,
        bankName: employeeCompensation.bankName,
        bankAccountNumber: employeeCompensation.bankAccountNumber,
      })
      .from(employeeCompensation)
      .where(eq(employeeCompensation.employeeId, employee.id))
      .limit(1);

    const securityDeductionPkr = compensation?.fixedSecurityDeductionPkr ?? 0;
    const totalOtherPayPkr = compensation?.fixedOtherPayPkr ?? 0;
    const leaveDeductionPkr = row.leaveDeductionPkr;
    const incomeTaxPkr = row.incomeTaxPkr;
    const additionalDeductionPkr = Math.max(
      0,
      row.totalDeductionPkr - leaveDeductionPkr - incomeTaxPkr - securityDeductionPkr,
    );
    const deductDays = Math.max(0, row.workingDays - row.daysWorked);

    const slipResult = await createOrReplaceSalarySlipFromSheet(
      {
        employeeId: employee.id,
        yearMonth,
        incomeTaxPkr,
        additionalDeductionPkr,
        totalDays: row.workingDays,
        earnedDays: row.daysWorked,
        deductDays,
        calculatedSalaryPkr: row.earnedSalaryPkr,
        autoLeaveDeductionPkr: leaveDeductionPkr,
        securityDeductionPkr,
        totalOtherPayPkr,
        totalDeductionPkr: row.totalDeductionPkr,
        netSalaryPkr: row.netSalaryPkr,
        transferDetails: formatTransferDetails(
          compensation?.bankName,
          compensation?.bankAccountNumber,
        ),
      },
      input.companyId,
      input.uploadedByUserId,
    );

    if (!slipResult.ok) {
      return slipResult;
    }

    if (slipResult.data.created) {
      slipsCreated += 1;
    } else {
      slipsUpdated += 1;
    }

    await db.insert(salarySheetRows).values({
      importId: importRow.id,
      companyId: input.companyId,
      yearMonth,
      employeeId: employee.id,
      salarySlipId: slipResult.data.id,
      employeeCode: employee.employeeCode,
      employeeName: employee.fullName,
      designation: row.designation ?? employee.designation,
      joiningDate: row.joiningDate ?? employee.createdAt.toISOString(),
      grossSalaryPkr: row.grossSalaryPkr,
      basicSalaryPkr: row.basicSalaryPkr,
      conveyanceAllowancePkr: row.conveyanceAllowancePkr,
      adhocPkr: row.adhocPkr,
      hrAllowancePkr: row.hrAllowancePkr,
      medicalAllowancePkr: row.medicalAllowancePkr,
      workingDays: row.workingDays,
      daysWorked: row.daysWorked,
      leaveDeductionPkr: row.leaveDeductionPkr,
      earnedSalaryPkr: row.earnedSalaryPkr,
      incomeTaxPkr: row.incomeTaxPkr,
      totalDeductionPkr: row.totalDeductionPkr,
      netSalaryPkr: row.netSalaryPkr,
      updatedAt: now,
    });

    imported += 1;
  }

  return {
    ok: true,
    data: {
      sheetName: parsed.sheetName,
      yearMonth,
      imported,
      unmatched,
      slipsCreated,
      slipsUpdated,
    },
  };
}
