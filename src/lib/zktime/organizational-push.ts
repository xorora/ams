import { eq } from "drizzle-orm";
import { db } from "@/db";
import { companies, employees } from "@/db/schema";
import type { ZktimeClient } from "@/lib/zktime/client";
import { setSyncStateValue, ZKTIME_LAST_EMPLOYEE_PUSH_AT } from "@/lib/zktime/sync-state";
import type {
  OrganizationalPushResult,
  ZktimeEmployeeUpsertRequest,
  ZktimeMasterDataSyncResponse,
} from "@/lib/zktime/types";
import { normalizeMasterDataSyncResponse } from "@/lib/zktime/types";

const DEFAULT_DEPARTMENT_NAME = "General";
const MAX_FULL_NAME_LENGTH = 40;
const MAX_DEPARTMENT_NAME_LENGTH = 30;

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

function normalizeBridgeEmployees(
  employees: ZktimeEmployeeUpsertRequest[],
): ZktimeEmployeeUpsertRequest[] {
  return employees.map((employee) => ({
    emp_code: employee.emp_code,
    full_name: truncateFullName(employee.full_name),
    ams_department_id: employee.ams_department_id ?? employee.department_id,
    department_name: employee.department_name?.trim().slice(0, MAX_DEPARTMENT_NAME_LENGTH),
    department_id: employee.department_id,
  }));
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

  const departments = departmentLabels.map((label) => {
    const amsId = departmentIdByLabel.get(normalizeKey(label)) ?? 1;
    return {
      ams_id: amsId,
      name: label.slice(0, MAX_DEPARTMENT_NAME_LENGTH),
    };
  });

  const bridgeEmployees = activeEmployees.map((employee) => {
    const label = departmentLabel(employee.companyName, employee.department);
    const departmentId = departmentIdByLabel.get(normalizeKey(label)) ?? 1;

    return {
      emp_code: employee.employeeCode,
      full_name: truncateFullName(employee.fullName),
      ams_department_id: departmentId,
      department_name: label.slice(0, MAX_DEPARTMENT_NAME_LENGTH),
    };
  });

  const result = await client.syncMasterData({
    departments,
    employees: bridgeEmployees,
    queue_to_device: true,
  });

  await setSyncStateValue(ZKTIME_LAST_EMPLOYEE_PUSH_AT, new Date().toISOString());

  const normalized = normalizeMasterDataSyncResponse(result);
  const employeesPushed =
    normalized.employeesSynced > 0
      ? normalized.employeesSynced
      : bridgeEmployees.length - normalized.failures.length;

  return {
    companies: companySlugs.size,
    departmentsMapped: departmentLabels.length,
    rolesTracked,
    employeesPushed,
    employeesFailed: normalized.failures.length,
    deviceSyncQueued: normalized.queuedForDevice,
    skippedUnchanged: normalized.skippedUnchanged,
    failures: normalized.failures,
    employees: normalized.employees,
    notes: [
      "ZKTime bridge has no company or role APIs; companies map to department groups and designations are tracked in AMS only.",
      "Department names are assigned stable ZKTime department_id values; create department names in ZKTime admin if you need them visible on the device UI.",
    ],
  };
}

export async function pushMasterDataToZktime(
  client: ZktimeClient,
  payload: {
    departments?: Array<{ id: number; name: string }>;
    employees: ZktimeEmployeeUpsertRequest[];
    queue_to_device?: boolean;
  },
): Promise<ZktimeMasterDataSyncResponse> {
  const result = await client.syncMasterData({
    departments: payload.departments?.map((department) => ({
      ams_id: department.id,
      name: department.name.trim().slice(0, MAX_DEPARTMENT_NAME_LENGTH),
    })),
    employees: normalizeBridgeEmployees(payload.employees),
    queue_to_device: payload.queue_to_device ?? true,
  });

  await setSyncStateValue(ZKTIME_LAST_EMPLOYEE_PUSH_AT, new Date().toISOString());
  return result;
}
