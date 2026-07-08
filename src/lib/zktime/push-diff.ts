import { codesMatch } from "@/lib/admin/employee-identity";
import type { ZktimeEmployee, ZktimeEmployeeUpsertRequest } from "@/lib/zktime/types";

const MAX_FULL_NAME_LENGTH = 40;

function normalizePushName(name: string): string {
  return name.trim().slice(0, MAX_FULL_NAME_LENGTH).trim().toLowerCase();
}

function normalizeDepartmentName(name: string | null | undefined): string {
  return (name?.trim() ?? "").toLowerCase().replace(/\s+/g, " ");
}

export function findZktimeEmployeeByCode(
  zktimeEmployees: ZktimeEmployee[],
  empCode: string,
): ZktimeEmployee | undefined {
  return zktimeEmployees.find((employee) => codesMatch(employee.emp_code, empCode));
}

export function employeeNeedsPushToZktime(
  bridgeEmployee: ZktimeEmployeeUpsertRequest,
  zktimeEmployee: ZktimeEmployee | undefined,
): boolean {
  if (!zktimeEmployee) {
    return true;
  }

  if (
    normalizePushName(bridgeEmployee.full_name) !== normalizePushName(zktimeEmployee.full_name)
  ) {
    return true;
  }

  const expectedDepartment = normalizeDepartmentName(bridgeEmployee.department_name);
  const currentDepartment = normalizeDepartmentName(zktimeEmployee.department?.dept_name);
  return expectedDepartment !== currentDepartment;
}

export function filterEmployeesNeedingPush(
  bridgeEmployees: ZktimeEmployeeUpsertRequest[],
  zktimeEmployees: ZktimeEmployee[],
): {
  employeesToPush: ZktimeEmployeeUpsertRequest[];
  skippedUnchanged: number;
} {
  const employeesToPush: ZktimeEmployeeUpsertRequest[] = [];

  for (const employee of bridgeEmployees) {
    const existing = findZktimeEmployeeByCode(zktimeEmployees, employee.emp_code);
    if (employeeNeedsPushToZktime(employee, existing)) {
      employeesToPush.push(employee);
    }
  }

  return {
    employeesToPush,
    skippedUnchanged: bridgeEmployees.length - employeesToPush.length,
  };
}
