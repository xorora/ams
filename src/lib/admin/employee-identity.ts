import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { employees } from "@/db/schema";

export type EmployeeRecord = typeof employees.$inferSelect;

const SYNTHETIC_EMAIL_DOMAINS = ["xorora.com", "crestled.com"] as const;

export function normalizeEmployeeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizeEmployeeCodeForMatch(code: string): string {
  return code.trim().toLowerCase();
}

export function isSyntheticSyncEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1];
  return domain != null && (SYNTHETIC_EMAIL_DOMAINS as readonly string[]).includes(domain);
}

function numericCodeVariants(code: string): string[] {
  const trimmed = code.trim();
  if (!/^\d+$/.test(trimmed)) {
    return [trimmed];
  }

  const withoutLeadingZeros = trimmed.replace(/^0+/, "") || "0";
  const variants = new Set([trimmed, withoutLeadingZeros, withoutLeadingZeros.padStart(3, "0")]);
  return [...variants];
}

export function codesMatch(left: string, right: string): boolean {
  const leftNormalized = normalizeEmployeeCodeForMatch(left);
  const rightNormalized = normalizeEmployeeCodeForMatch(right);
  if (leftNormalized === rightNormalized) {
    return true;
  }

  if (!/^\d+$/.test(left.trim()) || !/^\d+$/.test(right.trim())) {
    return false;
  }

  const leftVariants = new Set(numericCodeVariants(left).map(normalizeEmployeeCodeForMatch));
  return numericCodeVariants(right).some((variant) =>
    leftVariants.has(normalizeEmployeeCodeForMatch(variant)),
  );
}

export function areLikelyDuplicateEmployees(
  left: EmployeeRecord,
  right: EmployeeRecord,
): boolean {
  if (left.id === right.id || left.companyId !== right.companyId) {
    return false;
  }

  if (normalizeEmployeeName(left.fullName) !== normalizeEmployeeName(right.fullName)) {
    return false;
  }

  if (codesMatch(left.employeeCode, right.employeeCode)) {
    return true;
  }

  return isSyntheticSyncEmail(left.email) || isSyntheticSyncEmail(right.email);
}

export function pickCanonicalEmployee(candidates: EmployeeRecord[]): EmployeeRecord {
  return [...candidates].sort((left, right) => {
    if (Boolean(left.userId) !== Boolean(right.userId)) {
      return left.userId ? -1 : 1;
    }

    if (isSyntheticSyncEmail(left.email) !== isSyntheticSyncEmail(right.email)) {
      return isSyntheticSyncEmail(left.email) ? 1 : -1;
    }

    if (left.isActive !== right.isActive) {
      return left.isActive ? -1 : 1;
    }

    return left.createdAt.getTime() - right.createdAt.getTime();
  })[0];
}

export type EmployeeDuplicateCluster = {
  canonical: EmployeeRecord;
  members: EmployeeRecord[];
};

/** Group likely-duplicate rows; also link numeric code variants even when names differ slightly. */
export function groupEmployeeDuplicateClusters(
  records: EmployeeRecord[],
): EmployeeDuplicateCluster[] {
  const remaining = [...records];
  const clusters: EmployeeRecord[][] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const cluster = [seed];

    let changed = true;
    while (changed) {
      changed = false;
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        const candidate = remaining[index];
        const linked = cluster.some(
          (member) =>
            areLikelyDuplicateEmployees(member, candidate) ||
            codesMatch(member.employeeCode, candidate.employeeCode),
        );
        if (!linked) {
          continue;
        }
        cluster.push(candidate);
        remaining.splice(index, 1);
        changed = true;
      }
    }

    clusters.push(cluster);
  }

  return clusters
    .map((members) => ({
      canonical: pickCanonicalEmployee(members),
      members,
    }))
    .sort((left, right) =>
      left.canonical.fullName.localeCompare(right.canonical.fullName),
    );
}

export function dedupeEmployeeRecords(records: EmployeeRecord[]): EmployeeRecord[] {
  return groupEmployeeDuplicateClusters(records).map((cluster) => cluster.canonical);
}

/** Map every employee id in `records` onto its cluster canonical id. */
export function buildCanonicalEmployeeIdMap(records: EmployeeRecord[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const cluster of groupEmployeeDuplicateClusters(records)) {
    for (const member of cluster.members) {
      map.set(member.id, cluster.canonical.id);
    }
  }
  return map;
}

export async function findEmployeeByCodeVariants(
  employeeCode: string,
  companyId?: string,
): Promise<EmployeeRecord | null> {
  const trimmed = employeeCode.trim();
  if (!trimmed) {
    return null;
  }

  for (const variant of numericCodeVariants(trimmed)) {
    const [employee] = await db
      .select()
      .from(employees)
      .where(sql`lower(${employees.employeeCode}) = ${variant.toLowerCase()}`)
      .limit(1);

    if (!employee) {
      continue;
    }

    if (companyId && employee.companyId !== companyId) {
      continue;
    }

    return employee;
  }

  return null;
}

export async function findEmployeeForZktimeImport(input: {
  empCode: string;
  fullName: string;
  companyId: string;
}): Promise<EmployeeRecord | null> {
  const byCode = await findEmployeeByCodeVariants(input.empCode);
  if (byCode) {
    return byCode;
  }

  const normalizedName = normalizeEmployeeName(input.fullName);
  if (!normalizedName) {
    return null;
  }

  const companyEmployees = await db
    .select()
    .from(employees)
    .where(eq(employees.companyId, input.companyId));

  const matches = companyEmployees.filter((employee) => {
    if (normalizeEmployeeName(employee.fullName) !== normalizedName) {
      return false;
    }

    return (
      isSyntheticSyncEmail(employee.email) ||
      !employee.userId ||
      codesMatch(employee.employeeCode, input.empCode)
    );
  });

  if (matches.length === 1) {
    return matches[0];
  }

  if (matches.length > 1) {
    return pickCanonicalEmployee(matches);
  }

  return null;
}
