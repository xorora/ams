import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees } from "@/db/schema";
import type { WdmsClient } from "@/lib/wdms/client";
import { setSyncStateValue, WDMS_LAST_COMPANY_PUSH_AT } from "@/lib/wdms/sync-state";

const DEFAULT_DEPARTMENT_NAME = "General";

type AmsCompany = typeof companies.$inferSelect;
type AmsEmployee = typeof employees.$inferSelect;

type WdmsCompanyContext = {
  wdmsCompanyId: number;
  wdmsAreaIds: number[];
  departmentIdsByKey: Map<string, number>;
};

export type CompanyPushDetail = {
  companyName: string;
  companySlug: string;
  companiesCreated: number;
  areasCreated: number;
  departmentsCreated: number;
  employeesPushed: number;
  employeesSkipped: number;
  failures: Array<{ employeeCode: string; department: string; message: string }>;
};

export type AllCompaniesPushResult = {
  companies: CompanyPushDetail[];
  totals: {
    companiesCreated: number;
    areasCreated: number;
    departmentsCreated: number;
    employeesPushed: number;
    employeesSkipped: number;
    failures: number;
  };
};

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

function companyCodeFromSlug(slug: string): string {
  return slug.trim().toUpperCase().replace(/-/g, "_");
}

function areaCodeFromSlug(slug: string): string {
  return companyCodeFromSlug(slug).slice(0, 20);
}

function areaNameForCompany(companyName: string): string {
  return `${companyName.trim()} Office`;
}

function normalizeDepartmentKey(name: string): string {
  return name.trim().toLowerCase();
}

function departmentCodeFromName(name: string, companyCode: string): string {
  const normalized = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = normalized.slice(0, 12) || "DEPT";
  return `${companyCode}_${base}`.slice(0, 20);
}

function departmentCacheKey(wdmsCompanyId: number, departmentName: string): string {
  return `${wdmsCompanyId}:${normalizeDepartmentKey(departmentName)}`;
}

function resolveEmployeeDepartmentName(employee: AmsEmployee): string {
  return employee.department?.trim() || DEFAULT_DEPARTMENT_NAME;
}

async function ensureWdmsCompany(
  client: WdmsClient,
  amsCompany: AmsCompany,
): Promise<{ id: number; created: boolean }> {
  const wdmsCompanies = await client.getAllCompanies();
  const companyCode = companyCodeFromSlug(amsCompany.slug);
  const match = wdmsCompanies.find(
    (company) =>
      company.company_code.toLowerCase() === companyCode.toLowerCase() ||
      company.company_name.trim().toLowerCase() === amsCompany.name.trim().toLowerCase(),
  );

  if (match) {
    return { id: match.id, created: false };
  }

  const created = await client.createCompany({
    company_code: companyCode,
    company_name: amsCompany.name,
  });
  return { id: created.id, created: true };
}

async function ensureWdmsArea(
  client: WdmsClient,
  amsCompany: AmsCompany,
  wdmsCompanyId: number,
): Promise<{ areaIds: number[]; created: boolean }> {
  const areas = await client.getAllAreas();
  const targetName = areaNameForCompany(amsCompany.name).toLowerCase();
  const matches = areas.filter(
    (area) =>
      area.company?.id === wdmsCompanyId && area.area_name.trim().toLowerCase() === targetName,
  );

  if (matches.length > 0) {
    return { areaIds: matches.map((area) => area.id), created: false };
  }

  const created = await client.createArea({
    area_code: areaCodeFromSlug(amsCompany.slug),
    area_name: areaNameForCompany(amsCompany.name),
    company: wdmsCompanyId,
  });

  return { areaIds: [created.id], created: true };
}

async function ensureWdmsDepartment(
  client: WdmsClient,
  departmentName: string,
  wdmsCompanyId: number,
  companyCode: string,
  cache: Map<string, number>,
): Promise<{ id: number; created: boolean }> {
  const name = departmentName.trim() || DEFAULT_DEPARTMENT_NAME;
  const cacheKey = departmentCacheKey(wdmsCompanyId, name);

  if (cache.has(cacheKey)) {
    const cachedId = cache.get(cacheKey);
    if (cachedId !== undefined) {
      return { id: cachedId, created: false };
    }
  }

  const wdmsDepartments = await client.getAllDepartments();
  const match = wdmsDepartments.find(
    (dept) =>
      dept.company?.id === wdmsCompanyId &&
      normalizeDepartmentKey(dept.dept_name) === normalizeDepartmentKey(name),
  );

  if (match) {
    cache.set(cacheKey, match.id);
    return { id: match.id, created: false };
  }

  let attempt = 0;
  while (attempt < 5) {
    try {
      const deptCode =
        attempt === 0
          ? departmentCodeFromName(name, companyCode)
          : `${departmentCodeFromName(name, companyCode)}_${attempt + 1}`;
      const created = await client.createDepartment({
        dept_code: deptCode,
        dept_name: name,
        company: wdmsCompanyId,
      });
      cache.set(cacheKey, created.id);
      return { id: created.id, created: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("unique set") || attempt >= 4) {
        throw error;
      }
      attempt += 1;
    }
  }

  throw new Error(`Failed to create department "${name}" in WDMS.`);
}

async function pushEmployeeForDepartment(
  client: WdmsClient,
  employee: AmsEmployee,
  departmentName: string,
  context: WdmsCompanyContext,
): Promise<"pushed" | "skipped"> {
  if (!employee.isActive) {
    return "skipped";
  }

  const existing = await client.getEmployeeByCode(employee.employeeCode, context.wdmsCompanyId);
  if (existing) {
    return "skipped";
  }

  const cacheKey = departmentCacheKey(context.wdmsCompanyId, departmentName);
  const departmentId = context.departmentIdsByKey.get(cacheKey);
  const { firstName, lastName } = splitFullName(employee.fullName);

  await client.createEmployee({
    emp_code: employee.employeeCode,
    first_name: firstName || employee.employeeCode,
    last_name: lastName,
    company: context.wdmsCompanyId,
    department: departmentId,
    area: context.wdmsAreaIds,
    hire_date: new Date().toISOString().slice(0, 10),
  });

  return "pushed";
}

async function pushAmsCompanyToWdms(
  client: WdmsClient,
  amsCompany: AmsCompany,
): Promise<CompanyPushDetail> {
  const detail: CompanyPushDetail = {
    companyName: amsCompany.name,
    companySlug: amsCompany.slug,
    companiesCreated: 0,
    areasCreated: 0,
    departmentsCreated: 0,
    employeesPushed: 0,
    employeesSkipped: 0,
    failures: [],
  };

  const ensuredCompany = await ensureWdmsCompany(client, amsCompany);
  if (ensuredCompany.created) {
    detail.companiesCreated = 1;
  }

  const ensuredArea = await ensureWdmsArea(client, amsCompany, ensuredCompany.id);
  if (ensuredArea.created) {
    detail.areasCreated = 1;
  }

  const activeEmployees = await db
    .select()
    .from(employees)
    .where(and(eq(employees.companyId, amsCompany.id), eq(employees.isActive, true)));

  const departmentNames = new Map<string, string>();
  for (const employee of activeEmployees) {
    const name = resolveEmployeeDepartmentName(employee);
    const key = normalizeDepartmentKey(name);
    if (!departmentNames.has(key)) {
      departmentNames.set(key, name);
    }
  }

  const companyCode = companyCodeFromSlug(amsCompany.slug);
  const departmentIdsByKey = new Map<string, number>();

  for (const departmentName of departmentNames.values()) {
    const ensured = await ensureWdmsDepartment(
      client,
      departmentName,
      ensuredCompany.id,
      companyCode,
      departmentIdsByKey,
    );
    if (ensured.created) {
      detail.departmentsCreated += 1;
    }
  }

  const context: WdmsCompanyContext = {
    wdmsCompanyId: ensuredCompany.id,
    wdmsAreaIds: ensuredArea.areaIds,
    departmentIdsByKey,
  };

  for (const departmentName of departmentNames.values()) {
    const departmentKey = normalizeDepartmentKey(departmentName);
    const departmentEmployees = activeEmployees.filter(
      (employee) =>
        normalizeDepartmentKey(resolveEmployeeDepartmentName(employee)) === departmentKey,
    );

    for (const employee of departmentEmployees) {
      try {
        const result = await pushEmployeeForDepartment(client, employee, departmentName, context);
        if (result === "pushed") {
          detail.employeesPushed += 1;
        } else {
          detail.employeesSkipped += 1;
        }
      } catch (error) {
        detail.failures.push({
          employeeCode: employee.employeeCode,
          department: departmentName,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  return detail;
}

export async function pushAllCompaniesToWdms(client: WdmsClient): Promise<AllCompaniesPushResult> {
  const amsCompanies = await db
    .select()
    .from(companies)
    .where(eq(companies.isActive, true))
    .orderBy(companies.name);

  const companyResults: CompanyPushDetail[] = [];
  for (const amsCompany of amsCompanies) {
    companyResults.push(await pushAmsCompanyToWdms(client, amsCompany));
  }

  await setSyncStateValue(WDMS_LAST_COMPANY_PUSH_AT, new Date().toISOString());

  const totals = companyResults.reduce(
    (acc, result) => ({
      companiesCreated: acc.companiesCreated + result.companiesCreated,
      areasCreated: acc.areasCreated + result.areasCreated,
      departmentsCreated: acc.departmentsCreated + result.departmentsCreated,
      employeesPushed: acc.employeesPushed + result.employeesPushed,
      employeesSkipped: acc.employeesSkipped + result.employeesSkipped,
      failures: acc.failures + result.failures.length,
    }),
    {
      companiesCreated: 0,
      areasCreated: 0,
      departmentsCreated: 0,
      employeesPushed: 0,
      employeesSkipped: 0,
      failures: 0,
    },
  );

  return { companies: companyResults, totals };
}

export async function pushCompanyToWdmsBySlug(
  client: WdmsClient,
  companySlug: string,
): Promise<CompanyPushDetail> {
  const amsCompany = await db.query.companies.findFirst({
    where: eq(companies.slug, companySlug),
  });

  if (!amsCompany) {
    throw new Error(`Company not found: ${companySlug}`);
  }

  const result = await pushAmsCompanyToWdms(client, amsCompany);
  await setSyncStateValue(WDMS_LAST_COMPANY_PUSH_AT, new Date().toISOString());
  return result;
}

export async function pushAmsEmployeeToWdms(
  client: WdmsClient,
  employee: AmsEmployee,
): Promise<"pushed" | "skipped"> {
  const amsCompany = await db.query.companies.findFirst({
    where: eq(companies.id, employee.companyId),
  });

  if (!amsCompany) {
    throw new Error("Employee company not found.");
  }

  const ensuredCompany = await ensureWdmsCompany(client, amsCompany);
  const ensuredArea = await ensureWdmsArea(client, amsCompany, ensuredCompany.id);
  const departmentName = resolveEmployeeDepartmentName(employee);
  const departmentIdsByKey = new Map<string, number>();

  await ensureWdmsDepartment(
    client,
    departmentName,
    ensuredCompany.id,
    companyCodeFromSlug(amsCompany.slug),
    departmentIdsByKey,
  );

  return pushEmployeeForDepartment(client, employee, departmentName, {
    wdmsCompanyId: ensuredCompany.id,
    wdmsAreaIds: ensuredArea.areaIds,
    departmentIdsByKey,
  });
}
