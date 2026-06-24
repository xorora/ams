import type { employees } from "@/db/schema";

export type DeviceUserInfoRow = Pick<
  typeof employees.$inferSelect,
  "employeeCode" | "fullName" | "machineCardNo" | "department"
> & {
  /** AMS company name — used as device Dept when team/department is unset. */
  companyName?: string | null;
};

export function formatWireCommand(commandId: number | string, command: string): string {
  return `C:${commandId}:${command}`;
}

/** Device department: team name if set, otherwise company name (ZKBio Dept / ADMS DEPTINFO). */
export function resolveDeviceDepartment(employee: DeviceUserInfoRow): string | undefined {
  const team = employee.department?.trim();
  if (team) {
    return team;
  }
  const company = employee.companyName?.trim();
  return company || undefined;
}

export function buildUpdateUserInfoCommand(employee: DeviceUserInfoRow): string {
  const parts = [`PIN=${employee.employeeCode}`, `Name=${employee.fullName}`, `Pri=0`];

  if (employee.machineCardNo) {
    parts.push(`Card=${employee.machineCardNo}`);
  }

  const dept = resolveDeviceDepartment(employee);
  if (dept) {
    parts.push(`Dept=${dept}`);
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
