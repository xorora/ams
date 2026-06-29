import type { WdmsClient } from "@/lib/wdms/client";

const PROTECTED_AREA_NAMES = new Set(["not authorized", "ams office"]);
const PROTECTED_COMPANY_IDS = new Set([1]);
const PROTECTED_DEPARTMENT_NAMES = new Set(["department"]);

export type WdmsWipeResult = {
  employeesDeleted: number;
  departmentsDeleted: number;
  areasDeleted: number;
  companiesDeleted: number;
  failures: string[];
};

async function deleteById(
  client: WdmsClient,
  resource: string,
  id: number,
): Promise<{ ok: boolean; message?: string }> {
  try {
    await client.deleteResource(`${resource}/${id}/`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function wipeWdmsPersonnelData(client: WdmsClient): Promise<WdmsWipeResult> {
  const result: WdmsWipeResult = {
    employeesDeleted: 0,
    departmentsDeleted: 0,
    areasDeleted: 0,
    companiesDeleted: 0,
    failures: [],
  };

  const employees = await client.getAllEmployees();
  for (const employee of employees) {
    const deleted = await deleteById(client, "/personnel/api/employees", employee.id);
    if (deleted.ok) {
      result.employeesDeleted += 1;
    } else {
      result.failures.push(`employee ${employee.emp_code}: ${deleted.message}`);
    }
  }

  const departments = await client.getAllDepartments();
  for (const department of [...departments].sort((left, right) => right.id - left.id)) {
    if (PROTECTED_DEPARTMENT_NAMES.has(department.dept_name.trim().toLowerCase())) {
      continue;
    }

    const deleted = await deleteById(client, "/personnel/api/departments", department.id);
    if (deleted.ok) {
      result.departmentsDeleted += 1;
    } else {
      result.failures.push(`department ${department.dept_name}: ${deleted.message}`);
    }
  }

  const areas = await client.getAllAreas();
  for (const area of [...areas].sort((left, right) => right.id - left.id)) {
    if (PROTECTED_AREA_NAMES.has(area.area_name.trim().toLowerCase())) {
      continue;
    }

    const deleted = await deleteById(client, "/personnel/api/areas", area.id);
    if (deleted.ok) {
      result.areasDeleted += 1;
    } else {
      result.failures.push(`area ${area.area_name}: ${deleted.message}`);
    }
  }

  const companies = await client.getAllCompanies();
  for (const company of [...companies].sort((left, right) => right.id - left.id)) {
    if (PROTECTED_COMPANY_IDS.has(company.id)) {
      continue;
    }

    const deleted = await deleteById(client, "/personnel/api/company", company.id);
    if (deleted.ok) {
      result.companiesDeleted += 1;
    } else {
      result.failures.push(`company ${company.company_name}: ${deleted.message}`);
    }
  }

  return result;
}

export type WdmsResetAndPushResult = {
  wipe: WdmsWipeResult;
  push: import("@/lib/wdms/company-push").AllCompaniesPushResult;
};

export async function resetAndPushAllCompaniesToWdms(
  client: WdmsClient,
): Promise<WdmsResetAndPushResult> {
  const { pushAllCompaniesToWdms } = await import("@/lib/wdms/company-push");
  const wipe = await wipeWdmsPersonnelData(client);
  const push = await pushAllCompaniesToWdms(client);
  return { wipe, push };
}
