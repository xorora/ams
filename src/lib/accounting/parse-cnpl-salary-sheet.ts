import ExcelJS from "exceljs";

export type ParsedCnplSalaryRow = {
  excelCode: string;
  name: string;
  designation: string | null;
  joiningDate: string | null;
  grossSalaryPkr: number;
  basicSalaryPkr: number;
  conveyanceAllowancePkr: number;
  adhocPkr: number;
  hrAllowancePkr: number;
  medicalAllowancePkr: number;
  workingDays: number;
  daysWorked: number;
  leaveDeductionPkr: number;
  earnedSalaryPkr: number;
  incomeTaxPkr: number;
  totalDeductionPkr: number;
  netSalaryPkr: number;
};

export type ParseCnplSalarySheetResult = {
  sheetName: string;
  rows: ParsedCnplSalaryRow[];
};

type HeaderMap = {
  code: number;
  name: number;
  designation?: number;
  joiningDate?: number;
  gross: number;
  basic: number;
  conveyance?: number;
  adhoc: number;
  hr: number;
  medical: number;
  workingDays: number;
  daysWorked: number;
  leaveDeduction: number;
  earnedSalary: number;
  incomeTax: number;
  totalDeduction: number;
  netSalary: number;
};

function normalizeHeader(value: unknown): string {
  let text = "";
  if (value == null) {
    text = "";
  } else if (typeof value === "object") {
    const record = value as { text?: string; richText?: Array<{ text?: string }> };
    if (typeof record.text === "string") {
      text = record.text;
    } else if (Array.isArray(record.richText)) {
      text = record.richText.map((part) => part.text ?? "").join("");
    } else {
      text = String(value);
    }
  } else {
    text = String(value);
  }
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function cellScalar(value: ExcelJS.CellValue): unknown {
  if (value == null) {
    return null;
  }
  if (typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }
    const record = value as {
      result?: unknown;
      text?: string;
      richText?: Array<{ text?: string }>;
      formula?: string;
      sharedFormula?: string;
      error?: string;
    };
    if ("result" in record && record.result !== undefined && record.result !== null) {
      return cellScalar(record.result as ExcelJS.CellValue);
    }
    if (typeof record.text === "string") {
      return record.text;
    }
    if (Array.isArray(record.richText)) {
      return record.richText.map((part) => part.text ?? "").join("");
    }
    if (record.error) {
      return null;
    }
    return null;
  }
  return value;
}

function toNonNegativeInt(value: unknown): number {
  if (value == null || value === "") {
    return 0;
  }
  const num = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.max(0, Math.round(num));
}

function toOptionalDateIso(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^"|"$/g, "");
    if (!trimmed) {
      return null;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return trimmed;
  }
  return null;
}

function findHeaderRow(
  sheet: ExcelJS.Worksheet,
): { rowNumber: number; headers: Map<number, string> } | null {
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const headers = new Map<number, string>();
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      headers.set(col, normalizeHeader(cell.value));
    });
    const values = [...headers.values()];
    const hasCode = values.some((h) => h === "code" || h.includes("code"));
    const hasName = values.some((h) => h === "name" || h === "employee name");
    const hasAdhoc = values.some((h) => h.includes("adhoc"));
    const hasHr = values.some((h) => h === "hr" || h.startsWith("hr "));
    const hasMedical = values.some((h) => h.includes("medical"));
    if (hasCode && hasName && hasAdhoc && hasHr && hasMedical) {
      return { rowNumber, headers };
    }
  }
  return null;
}

function pickColumn(headers: Map<number, string>, predicates: Array<(h: string) => boolean>): number | undefined {
  for (const [col, header] of headers) {
    if (predicates.some((predicate) => predicate(header))) {
      return col;
    }
  }
  return undefined;
}

function buildHeaderMap(headers: Map<number, string>): HeaderMap | null {
  const code = pickColumn(headers, [(h) => h === "code" || h.includes("code")]);
  const name = pickColumn(headers, [(h) => h === "name" || h === "employee name"]);
  const adhoc = pickColumn(headers, [(h) => h.includes("adhoc")]);
  const hr = pickColumn(headers, [(h) => h === "hr" || h.startsWith("hr ")]);
  const medical = pickColumn(headers, [(h) => h.includes("medical")]);
  const gross = pickColumn(headers, [
    (h) => h.includes("gross") || (h.includes("monthly") && h.includes("salary")),
  ]);
  const basic = pickColumn(headers, [(h) => h.includes("basic")]);
  const workingDays = pickColumn(headers, [
    (h) => h.includes("total working") || h === "working days",
  ]);
  const daysWorked = pickColumn(headers, [(h) => h.includes("days worked")]);
  const leaveDeduction = pickColumn(headers, [(h) => h.includes("leave deduction")]);
  const earnedSalary = pickColumn(headers, [
    (h) => h.includes("current earned") || h.includes("earned salary"),
  ]);
  const incomeTax = pickColumn(headers, [(h) => h.includes("income tax")]);
  const totalDeduction = pickColumn(headers, [(h) => h === "total"]);
  const netSalary = pickColumn(headers, [(h) => h.includes("net salary") || h === "net"]);

  if (
    code == null ||
    name == null ||
    adhoc == null ||
    hr == null ||
    medical == null ||
    gross == null ||
    basic == null ||
    workingDays == null ||
    daysWorked == null ||
    leaveDeduction == null ||
    earnedSalary == null ||
    incomeTax == null ||
    totalDeduction == null ||
    netSalary == null
  ) {
    return null;
  }

  return {
    code,
    name,
    designation: pickColumn(headers, [(h) => h.includes("designation")]),
    joiningDate: pickColumn(headers, [(h) => h.includes("joining") || h === "date"]),
    gross,
    basic,
    conveyance: pickColumn(headers, [(h) => h.includes("conveyance") || h.includes("fuel")]),
    adhoc,
    hr,
    medical,
    workingDays,
    daysWorked,
    leaveDeduction,
    earnedSalary,
    incomeTax,
    totalDeduction,
    netSalary,
  };
}

function readCell(row: ExcelJS.Row, col: number | undefined): unknown {
  if (col == null) {
    return null;
  }
  return cellScalar(row.getCell(col).value);
}

function recomputeLeaveDeduction(args: {
  basicSalaryPkr: number;
  conveyanceAllowancePkr: number;
  adhocPkr: number;
  hrAllowancePkr: number;
  medicalAllowancePkr: number;
  workingDays: number;
  daysWorked: number;
}): number {
  const base =
    args.basicSalaryPkr +
    args.conveyanceAllowancePkr +
    args.adhocPkr +
    args.hrAllowancePkr +
    args.medicalAllowancePkr;
  if (args.workingDays <= 0) {
    return 0;
  }
  const deductDays = Math.max(0, args.workingDays - args.daysWorked);
  return Math.round((base / args.workingDays) * deductDays);
}

function parseDataRow(row: ExcelJS.Row, map: HeaderMap): ParsedCnplSalaryRow | null {
  const nameRaw = readCell(row, map.name);
  const name = nameRaw == null ? "" : String(nameRaw).trim();
  if (!name) {
    return null;
  }

  const normalizedName = name.toLowerCase().replace(/\s+/g, " ");
  if (
    normalizedName.includes("sub-total") ||
    normalizedName.includes("subtotal") ||
    normalizedName === "total" ||
    normalizedName.startsWith("grand total") ||
    /^_+$/.test(name.replace(/\s/g, ""))
  ) {
    return null;
  }

  const excelCodeRaw = readCell(row, map.code);
  const excelCode = excelCodeRaw == null ? "" : String(excelCodeRaw).trim();

  const basicSalaryPkr = toNonNegativeInt(readCell(row, map.basic));
  const conveyanceAllowancePkr = toNonNegativeInt(readCell(row, map.conveyance));
  const adhocPkr = toNonNegativeInt(readCell(row, map.adhoc));
  const hrAllowancePkr = toNonNegativeInt(readCell(row, map.hr));
  const medicalAllowancePkr = toNonNegativeInt(readCell(row, map.medical));
  const workingDays = toNonNegativeInt(readCell(row, map.workingDays));
  const daysWorked = toNonNegativeInt(readCell(row, map.daysWorked));

  let leaveDeductionPkr = toNonNegativeInt(readCell(row, map.leaveDeduction));
  if (leaveDeductionPkr === 0 && workingDays > daysWorked) {
    leaveDeductionPkr = recomputeLeaveDeduction({
      basicSalaryPkr,
      conveyanceAllowancePkr,
      adhocPkr,
      hrAllowancePkr,
      medicalAllowancePkr,
      workingDays,
      daysWorked,
    });
  }

  let earnedSalaryPkr = toNonNegativeInt(readCell(row, map.earnedSalary));
  if (earnedSalaryPkr === 0) {
    const components =
      basicSalaryPkr + conveyanceAllowancePkr + adhocPkr + hrAllowancePkr + medicalAllowancePkr;
    earnedSalaryPkr = Math.max(0, components - leaveDeductionPkr);
  }

  const grossSalaryPkr = toNonNegativeInt(readCell(row, map.gross)) || earnedSalaryPkr + leaveDeductionPkr;
  if (grossSalaryPkr <= 0 && basicSalaryPkr <= 0 && earnedSalaryPkr <= 0) {
    return null;
  }

  const incomeTaxPkr = toNonNegativeInt(readCell(row, map.incomeTax));
  let totalDeductionPkr = toNonNegativeInt(readCell(row, map.totalDeduction));
  if (totalDeductionPkr === 0) {
    totalDeductionPkr = leaveDeductionPkr + incomeTaxPkr;
  }
  let netSalaryPkr = toNonNegativeInt(readCell(row, map.netSalary));
  if (netSalaryPkr === 0 && earnedSalaryPkr > 0) {
    netSalaryPkr = Math.max(0, earnedSalaryPkr - incomeTaxPkr);
  }

  const designationRaw = readCell(row, map.designation);
  const designation =
    designationRaw == null || String(designationRaw).trim() === ""
      ? null
      : String(designationRaw).trim();

  return {
    excelCode,
    name,
    designation,
    joiningDate: toOptionalDateIso(readCell(row, map.joiningDate)),
    grossSalaryPkr,
    basicSalaryPkr,
    conveyanceAllowancePkr,
    adhocPkr,
    hrAllowancePkr,
    medicalAllowancePkr,
    workingDays,
    daysWorked,
    leaveDeductionPkr,
    earnedSalaryPkr,
    incomeTaxPkr,
    totalDeductionPkr,
    netSalaryPkr,
  };
}

export async function parseCnplSalarySheetBuffer(
  buffer: Buffer,
): Promise<ParseCnplSalarySheetResult> {
  const workbook = new ExcelJS.Workbook();
  // exceljs accepts ArrayBuffer / Buffer-like; cast for Node Buffer
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  for (const sheet of workbook.worksheets) {
    const header = findHeaderRow(sheet);
    if (!header) {
      continue;
    }
    const map = buildHeaderMap(header.headers);
    if (!map) {
      continue;
    }

    const rows: ParsedCnplSalaryRow[] = [];
    for (let rowNumber = header.rowNumber + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const excelRow = sheet.getRow(rowNumber);
      const parsed = parseDataRow(excelRow, map);
      if (parsed) {
        rows.push(parsed);
      }
    }

    if (rows.length > 0) {
      return { sheetName: sheet.name, rows };
    }
  }

  throw new Error(
    "No CNPL-format salary sheet found. Expected headers including Code, NAME, ADHOC, HR, and Medical.",
  );
}
