import type { employees } from "@/db/schema";

type EmployeeRow = Pick<
  typeof employees.$inferSelect,
  "employeeCode" | "fullName" | "machineCardNo" | "department"
>;

export function formatWireCommand(commandId: number | string, command: string): string {
  return `C:${commandId}:${command}`;
}

export function buildUpdateUserInfoCommand(employee: EmployeeRow): string {
  const parts = [`PIN=${employee.employeeCode}`, `Name=${employee.fullName}`, `Pri=0`];

  if (employee.machineCardNo) {
    parts.push(`Card=${employee.machineCardNo}`);
  }

  if (employee.department?.trim()) {
    parts.push(`Dept=${employee.department.trim()}`);
  }

  return `DATA UPDATE USERINFO ${parts.join("\t")}`;
}

export function buildDeleteUserInfoCommand(employeeCode: string): string {
  return `DATA DELETE USERINFO PIN=${employeeCode}`;
}

export function buildQueryUserInfoCommand(pin?: string): string {
  if (pin) {
    return `DATA QUERY USERINFO PIN=${pin}`;
  }
  return "DATA QUERY USERINFO";
}

export function buildUpdateDeptInfoCommand(deptId: string, deptName: string): string {
  return `DATA UPDATE DEPTINFO DEPTID=${deptId}\tDEPTNAME=${deptName}`;
}

export function buildQueryDeptInfoCommand(): string {
  return "DATA QUERY DEPTINFO";
}
