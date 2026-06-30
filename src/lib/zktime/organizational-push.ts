import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees } from "@/db/schema";
import type { ZktimeClient } from "@/lib/zktime/client";
import { setSyncStateValue, ZKTIME_LAST_EMPLOYEE_PUSH_AT } from "@/lib/zktime/sync-state";
import type { OrganizationalPushResult, ZktimeEmployeeUpsertRequest } from "@/lib/zktime/types";

const DEFAULT_DEPARTMENT_NAME = "General";
const MAX_FULL_NAME_LENGTH = 40;

type AmsEmployeeRow = {
  employeeCode: string;
  fullName: string;
  department: string | null;
  designation: string | null;
  companyName: string;
  companySlug: string;
};

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function truncateFullName(fullName: string): string {
  return fullName.trim().slice(0, MAX_FULL_NAME_LENGTH);
}

function departmentLabel(companyName: string, department: string | null): string {
  const dept = department?.trim() || DEFAULT_DEPARTMENT_NAME;
  return `${companyName.trim()} - ${dept}`;
}

export function buildDepartmentIdMap(
  existingDepartments: Array<{ id: number; dept_name: string }>,
  labels: string[],
): Map<string, number> {
  const map = new Map<string, number>();

  for (const department of existingDepartments) {
    const name = department.dept_name?.trim();
    if (!name) {
      continue;
    }
    map.set(normalizeKey(name), department.id);
  }

  let nextId = Math.max(1, ...existingDepartments.map((department) => department.id), 0) + 1;

  for (const label of [...labels].sort()) {
    const key = normalizeKey(label);
    if (map.has(key)) {
      continue;
    }

    const departmentOnly = normalizeKey(label.split(" - ").slice(1).join(" - ") || label);
    const companyOnly = normalizeKey(label.split(" - ")[0] ?? label);

    const matchedByDepartment = [...map.entries()].find(
      ([existingKey]) =>
        existingKey === departmentOnly ||
        existingKey.endsWith(` - ${departmentOnly}`) ||
        departmentOnly.endsWith(existingKey),
    );
    if (matchedByDepartment) {
      map.set(key, matchedByDepartment[1]);
      continue;
    }

    const matchedByCompany = [...map.entries()].find(
      ([existingKey]) => existingKey === companyOnly,
    );
    if (matchedByCompany && departmentOnly === normalizeKey(DEFAULT_DEPARTMENT_NAME)) {
      map.set(key, matchedByCompany[1]);
      continue;
    }

    map.set(key, nextId);
    nextId += 1;
  }

  return map;
}

async function loadActiveEmployees(): Promise<AmsEmployeeRow[]> {
  return db
    .select({
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      department: employees.department,
      designation: employees.designation,
      companyName: companies.name,
      companySlug: companies.slug,
    })
    .from(employees)
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(eq(employees.isActive, true))
    .orderBy(companies.name, employees.employeeCode);
}

export async function pushAllOrganizationalDataToZktime(
  client: ZktimeClient,
): Promise<OrganizationalPushResult> {
  const activeEmployees = await loadActiveEmployees();
  const companySlugs = new Set(activeEmployees.map((employee) => employee.companySlug));
  const departmentLabels = [
    ...new Set(
      activeEmployees.map((employee) => departmentLabel(employee.companyName, employee.department)),
    ),
  ];
  const rolesTracked = new Set(
    activeEmployees.flatMap((employee) =>
      employee.designation?.trim() ? [employee.designation.trim()] : [],
    ),
  ).size;

  const zktimeDepartments = await client.getAllDepartments();
  const departmentIdByLabel = buildDepartmentIdMap(zktimeDepartments, departmentLabels);

  const failures: OrganizationalPushResult["failures"] = [];
  let employeesPushed = 0;

  for (const employee of activeEmployees) {
    const label = departmentLabel(employee.companyName, employee.department);
    const departmentId = departmentIdByLabel.get(normalizeKey(label)) ?? 1;

    const payload: ZktimeEmployeeUpsertRequest = {
      emp_code: employee.employeeCode,
      full_name: truncateFullName(employee.fullName),
      department_id: departmentId,
    };

    try {
      await client.upsertEmployee(payload);
      employeesPushed += 1;
    } catch (error) {
      failures.push({
        emp_code: employee.employeeCode,
        message: error instanceof Error ? error.message : "Unknown push failure",
      });
    }
  }

  let deviceSyncQueued = 0;
  if (employeesPushed > 0) {
    const syncResult = await client.syncEmployeesToDevice({
      emp_codes: activeEmployees
        .map((employee) => employee.employeeCode)
        .filter((code) => !failures.some((failure) => failure.emp_code === code)),
    });
    deviceSyncQueued = syncResult.queued;
  }

  await setSyncStateValue(ZKTIME_LAST_EMPLOYEE_PUSH_AT, new Date().toISOString());

  return {
    companies: companySlugs.size,
    departmentsMapped: departmentLabels.length,
    rolesTracked,
    employeesPushed,
    employeesFailed: failures.length,
    deviceSyncQueued,
    failures,
    notes: [
      "ZKTime bridge has no company or role APIs; companies map to department groups and designations are tracked in AMS only.",
      "Department names are assigned stable ZKTime department_id values; create department names in ZKTime admin if you need them visible on the device UI.",
    ],
  };
}
