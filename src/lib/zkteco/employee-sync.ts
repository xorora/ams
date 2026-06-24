import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  biometricEmployeeMappings,
  companies,
  employees,
  machinePunches,
  syncState,
  zktecoDeviceCommands,
  zktecoDevices,
} from "@/db/schema";
import { relinkMachinePunchesToEmployees } from "@/lib/attendance/machine-punch-processor";
import {
  buildDeleteUserInfoCommand,
  buildQueryUserInfoCommand,
  buildUpdateUserInfoCommand,
  type DeviceUserInfoRow,
} from "@/lib/zkteco/adms/commands";
import type { UserInfoRecord } from "@/lib/zkteco/adms/parser";
import { getCompaniesToSync } from "@/lib/zkteco/company-sync";
import { getZktecoDefaultCompanySlug, shouldSyncAllCompanies } from "@/lib/zkteco/config";
import {
  enqueueDeviceCommand,
  formatDeviceLastSeen,
  getDeviceConnectionStatus,
  getSecondsSinceLastSeen,
  isDeviceReachable,
} from "@/lib/zkteco/device-service";

const FUZZY_MATCH_THRESHOLD = 85;
const DEFAULT_USER_SYNC_INTERVAL_HOURS = 24;

type MatchMethod = "device_pin" | "card" | "mapping" | "exact_name" | "fuzzy_name" | "created";

type MatchOutcome = {
  employeeId: string;
  matchMethod: MatchMethod;
  matchScore: number | null;
  created: boolean;
};

export type UserInfoIngestResult = {
  processed: number;
  matched: number;
  created: number;
  unmatched: number;
};

export type DeviceUserPullResult = {
  deviceId: string;
  queued: boolean;
  reason?: string;
  commandId?: string;
};

export type DeviceEmployeePushResult = {
  deviceId: string;
  queued: number;
};

export type DeviceSyncResult = {
  deviceId: string;
  push: DeviceEmployeePushResult;
  pull: DeviceUserPullResult;
  companyPush: { deviceId: string; queued: number };
  companyPull: { deviceId: string; queued: boolean; reason?: string; commandId?: string };
};

export type SyncDirection = "both" | "push" | "pull" | "companies" | "employees" | "sync";

export type DeviceSyncSummary = {
  companiesPushed: number;
  employeesPushed: number;
  companyPullQueued: boolean;
  userPullQueued: boolean;
  totalCommands: number;
  estimatedMinutes: number;
};

export function summarizeDeviceSync(result: DeviceSyncResult): DeviceSyncSummary {
  const totalCommands =
    result.companyPush.queued +
    result.push.queued +
    (result.companyPull.queued ? 1 : 0) +
    (result.pull.queued ? 1 : 0);

  return {
    companiesPushed: result.companyPush.queued,
    employeesPushed: result.push.queued,
    companyPullQueued: result.companyPull.queued,
    userPullQueued: result.pull.queued,
    totalCommands,
    estimatedMinutes: Math.max(1, Math.ceil((totalCommands * 5) / 60)),
  };
}

function syncStateKey(prefix: string, deviceId: string): string {
  return `${prefix}:${deviceId}`;
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function nameSimilarityScore(a: string, b: string): number {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) {
    return 0;
  }
  if (left === right) {
    return 100;
  }

  const distance = levenshteinDistance(left, right);
  const maxLen = Math.max(left.length, right.length);
  return Math.round((1 - distance / maxLen) * 100);
}

function emailDomainForSlug(slug: string): string {
  if (slug === "crest-led") {
    return "crestled.com";
  }
  if (slug === "xorora") {
    return "xorora.com";
  }
  return `${slug.replace(/-/g, "")}.com`;
}

function formatEmployeeCode(pin: string): string {
  const trimmed = pin.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed.padStart(3, "0");
  }
  return trimmed;
}

async function getSyncStateValue(key: string): Promise<string | null> {
  const row = await db.query.syncState.findFirst({
    where: eq(syncState.key, key),
  });
  return row?.value ?? null;
}

async function setSyncStateValue(key: string, value: string): Promise<void> {
  await db
    .insert(syncState)
    .values({ key, value })
    .onConflictDoUpdate({
      target: syncState.key,
      set: { value, updatedAt: new Date() },
    });
}

function getUserSyncIntervalMs(): number {
  const hours = Number.parseInt(process.env.ZKTECO_USER_SYNC_INTERVAL_HOURS ?? "", 10);
  const resolved = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_USER_SYNC_INTERVAL_HOURS;
  return resolved * 60 * 60 * 1000;
}

async function getAllDevices() {
  return db.select().from(zktecoDevices).orderBy(desc(zktecoDevices.lastSeenAt));
}

async function getEmployeesWithCompanyForSync(): Promise<DeviceUserInfoRow[]> {
  if (shouldSyncAllCompanies()) {
    return db
      .select({
        employeeCode: employees.employeeCode,
        fullName: employees.fullName,
        machineCardNo: employees.machineCardNo,
        department: employees.department,
        companyName: companies.name,
      })
      .from(employees)
      .innerJoin(companies, eq(employees.companyId, companies.id))
      .where(and(eq(employees.isActive, true), eq(companies.isActive, true)));
  }

  const slug = getZktecoDefaultCompanySlug();
  const company = await db.query.companies.findFirst({
    where: eq(companies.slug, slug),
  });

  if (!company) {
    return [];
  }

  const rows = await db
    .select({
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      machineCardNo: employees.machineCardNo,
      department: employees.department,
    })
    .from(employees)
    .where(and(eq(employees.companyId, company.id), eq(employees.isActive, true)));

  return rows.map((row) => ({ ...row, companyName: company.name }));
}

async function resolveCompanyIdForDeviceUser(record: UserInfoRecord): Promise<string | null> {
  const dept = record.department?.trim();
  if (dept) {
    const companiesToSync = await getCompaniesToSync();
    const match = companiesToSync.find(
      (company) => company.name.toLowerCase() === dept.toLowerCase(),
    );
    if (match) {
      return match.id;
    }
  }

  const defaultCompany = await db.query.companies.findFirst({
    where: eq(companies.slug, getZktecoDefaultCompanySlug()),
  });
  return defaultCompany?.id ?? null;
}

async function getEmployeesToSync(): Promise<Array<typeof employees.$inferSelect>> {
  if (shouldSyncAllCompanies()) {
    return db
      .select({ employee: employees })
      .from(employees)
      .innerJoin(companies, eq(employees.companyId, companies.id))
      .where(and(eq(employees.isActive, true), eq(companies.isActive, true)))
      .then((rows) => rows.map((row) => row.employee));
  }

  const slug = getZktecoDefaultCompanySlug();
  const company = await db.query.companies.findFirst({
    where: eq(companies.slug, slug),
  });

  if (!company) {
    return [];
  }

  return db
    .select()
    .from(employees)
    .where(and(eq(employees.companyId, company.id), eq(employees.isActive, true)));
}

async function hasPendingUserQuery(deviceId: string): Promise<boolean> {
  const commands = await db.query.zktecoDeviceCommands.findMany({
    where: and(
      eq(zktecoDeviceCommands.deviceId, deviceId),
      inArray(zktecoDeviceCommands.status, ["pending", "sent"]),
    ),
  });

  return commands.some((command) => command.commandText.includes("QUERY USERINFO"));
}

type EmployeeContext = {
  employees: Array<typeof employees.$inferSelect>;
  byId: Map<string, typeof employees.$inferSelect>;
  byCode: Map<string, typeof employees.$inferSelect>;
  byCard: Map<string, typeof employees.$inferSelect>;
  byNormalizedName: Map<string, Array<typeof employees.$inferSelect>>;
  mappingsByPin: Map<string, typeof biometricEmployeeMappings.$inferSelect>;
  mappingsByCard: Map<string, typeof biometricEmployeeMappings.$inferSelect>;
  takenEmails: Set<string>;
  takenCodes: Set<string>;
  companyId: string;
};

async function loadEmployeeContext(): Promise<EmployeeContext | null> {
  const employeeRows = await getEmployeesToSync();
  if (employeeRows.length === 0 && !shouldSyncAllCompanies()) {
    const slug = getZktecoDefaultCompanySlug();
    const company = await db.query.companies.findFirst({
      where: eq(companies.slug, slug),
    });
    if (!company) {
      console.error(`[zkteco/employee-sync] Company slug not found: ${slug}`);
      return null;
    }
  }

  const companyId =
    employeeRows[0]?.companyId ??
    (
      await db.query.companies.findFirst({
        where: eq(companies.slug, getZktecoDefaultCompanySlug()),
      })
    )?.id;

  if (!companyId) {
    return null;
  }

  const mappingRows = await db.select().from(biometricEmployeeMappings);

  const byId = new Map<string, typeof employees.$inferSelect>();
  const byCode = new Map<string, typeof employees.$inferSelect>();
  const byCard = new Map<string, typeof employees.$inferSelect>();
  const byNormalizedName = new Map<string, Array<typeof employees.$inferSelect>>();
  const takenEmails = new Set<string>();
  const takenCodes = new Set<string>();

  for (const employee of employeeRows) {
    byId.set(employee.id, employee);
    byCode.set(employee.employeeCode, employee);
    takenEmails.add(employee.email.toLowerCase());
    takenCodes.add(employee.employeeCode);
    if (employee.machineCardNo) {
      byCard.set(employee.machineCardNo, employee);
    }
    const normalized = normalizeName(employee.fullName);
    const bucket = byNormalizedName.get(normalized) ?? [];
    bucket.push(employee);
    byNormalizedName.set(normalized, bucket);
  }

  const mappingsByPin = new Map<string, typeof biometricEmployeeMappings.$inferSelect>();
  const mappingsByCard = new Map<string, typeof biometricEmployeeMappings.$inferSelect>();
  for (const mapping of mappingRows) {
    if (mapping.devicePin) {
      mappingsByPin.set(mapping.devicePin, mapping);
    }
    mappingsByCard.set(mapping.cardNo, mapping);
  }

  return {
    employees: employeeRows,
    byId,
    byCode,
    byCard,
    byNormalizedName,
    mappingsByPin,
    mappingsByCard,
    takenEmails,
    takenCodes,
    companyId,
  };
}

function pickExactNameMatch(
  _record: UserInfoRecord,
  matches: Array<typeof employees.$inferSelect>,
): typeof employees.$inferSelect | null {
  if (matches.length === 0) {
    return null;
  }
  if (matches.length === 1) {
    return matches[0];
  }

  const unlinked = matches.filter((employee) => !employee.machineCardNo);
  if (unlinked.length === 1) {
    return unlinked[0];
  }

  return [...matches].sort((a, b) => a.id.localeCompare(b.id))[0] ?? null;
}

function matchDeviceUser(record: UserInfoRecord, ctx: EmployeeContext): MatchOutcome | null {
  const cardNo = record.card?.trim() || record.pin;
  const normalized = normalizeName(record.name?.trim() || record.pin);

  const byPin = ctx.byCode.get(record.pin);
  if (byPin) {
    return { employeeId: byPin.id, matchMethod: "device_pin", matchScore: null, created: false };
  }

  if (cardNo) {
    const byCard = ctx.byCard.get(cardNo);
    if (byCard) {
      return { employeeId: byCard.id, matchMethod: "card", matchScore: null, created: false };
    }
  }

  const mapping = ctx.mappingsByPin.get(record.pin) ?? ctx.mappingsByCard.get(cardNo);
  if (mapping && ctx.byId.has(mapping.employeeId)) {
    return {
      employeeId: mapping.employeeId,
      matchMethod: "mapping",
      matchScore: mapping.matchScore,
      created: false,
    };
  }

  const exact = pickExactNameMatch(record, ctx.byNormalizedName.get(normalized) ?? []);
  if (exact) {
    return { employeeId: exact.id, matchMethod: "exact_name", matchScore: null, created: false };
  }

  let bestId: string | null = null;
  let bestScore = 0;
  for (const employee of ctx.employees) {
    const score = nameSimilarityScore(record.name?.trim() || record.pin, employee.fullName);
    if (score > bestScore) {
      bestScore = score;
      bestId = employee.id;
    }
  }

  if (bestId && bestScore >= FUZZY_MATCH_THRESHOLD) {
    return { employeeId: bestId, matchMethod: "fuzzy_name", matchScore: bestScore, created: false };
  }

  return null;
}

function generateUniqueEmail(fullName: string, domain: string, takenEmails: Set<string>): string {
  const baseLocal = normalizeName(fullName) || "employee";
  let candidate = `${baseLocal}@${domain}`.toLowerCase();
  if (!takenEmails.has(candidate)) {
    takenEmails.add(candidate);
    return candidate;
  }

  let suffix = 2;
  while (true) {
    candidate = `${baseLocal}-${suffix}@${domain}`.toLowerCase();
    if (!takenEmails.has(candidate)) {
      takenEmails.add(candidate);
      return candidate;
    }
    suffix += 1;
  }
}

function generateUniqueEmployeeCode(baseCode: string, takenCodes: Set<string>): string {
  if (!takenCodes.has(baseCode)) {
    takenCodes.add(baseCode);
    return baseCode;
  }

  let suffix = 2;
  while (true) {
    const candidate = `${baseCode}-${suffix}`;
    if (!takenCodes.has(candidate)) {
      takenCodes.add(candidate);
      return candidate;
    }
    suffix += 1;
  }
}

async function createEmployeeFromDeviceUser(
  record: UserInfoRecord,
  cardNo: string,
  ctx: EmployeeContext,
): Promise<typeof employees.$inferSelect | null> {
  const companyId = (await resolveCompanyIdForDeviceUser(record)) ?? ctx.companyId;
  const slug =
    (
      await db.query.companies.findFirst({
        where: eq(companies.id, companyId),
      })
    )?.slug ?? getZktecoDefaultCompanySlug();
  const domain = emailDomainForSlug(slug);
  const baseCode = formatEmployeeCode(record.pin);
  const employeeCode = generateUniqueEmployeeCode(baseCode, ctx.takenCodes);
  const fullName = record.name?.trim() || record.pin;
  const email = generateUniqueEmail(fullName, domain, ctx.takenEmails);

  const [created] = await db
    .insert(employees)
    .values({
      employeeCode,
      fullName,
      email,
      companyId,
      department: record.department?.trim() || null,
      machineCardNo: cardNo !== record.pin && !ctx.byCard.has(cardNo) ? cardNo : null,
    })
    .returning();

  ctx.employees.push(created);
  ctx.byId.set(created.id, created);
  ctx.byCode.set(created.employeeCode, created);
  if (created.machineCardNo) {
    ctx.byCard.set(created.machineCardNo, created);
  }
  const normalized = normalizeName(created.fullName);
  const bucket = ctx.byNormalizedName.get(normalized) ?? [];
  bucket.push(created);
  ctx.byNormalizedName.set(normalized, bucket);

  return created;
}

async function upsertBiometricMapping(
  deviceId: string,
  record: UserInfoRecord,
  cardNo: string,
  name: string,
  employeeId: string,
  matchMethod: MatchMethod,
  matchScore: number | null,
): Promise<void> {
  const existing =
    (await db.query.biometricEmployeeMappings.findFirst({
      where: eq(biometricEmployeeMappings.devicePin, record.pin),
    })) ??
    (await db.query.biometricEmployeeMappings.findFirst({
      where: eq(biometricEmployeeMappings.cardNo, cardNo),
    }));

  const payload = {
    devicePin: record.pin,
    zktecoDeviceId: deviceId,
    cardNo,
    machineEmpCode: record.pin,
    machineEmpName: name,
    normalizedName: normalizeName(name),
    employeeId,
    matchMethod,
    matchScore,
    updatedAt: new Date(),
  };

  if (existing) {
    await db
      .update(biometricEmployeeMappings)
      .set(payload)
      .where(eq(biometricEmployeeMappings.id, existing.id));
    return;
  }

  await db.insert(biometricEmployeeMappings).values(payload);
}

async function markUserSyncCompleted(deviceId: string): Promise<void> {
  const now = new Date().toISOString();
  await setSyncStateValue(syncStateKey("zkteco_last_user_sync_at", deviceId), now);
  await setSyncStateValue(syncStateKey("zkteco_bootstrap_completed", deviceId), "true");
}

export async function enqueueEmployeePush(employeeId: string): Promise<void> {
  const row = await db
    .select({
      employeeCode: employees.employeeCode,
      fullName: employees.fullName,
      machineCardNo: employees.machineCardNo,
      department: employees.department,
      companyName: companies.name,
      isActive: employees.isActive,
    })
    .from(employees)
    .innerJoin(companies, eq(employees.companyId, companies.id))
    .where(eq(employees.id, employeeId))
    .then((rows) => rows[0]);

  if (!row?.isActive) {
    return;
  }

  const devices = await getAllDevices();
  if (devices.length === 0) {
    return;
  }

  const command = buildUpdateUserInfoCommand(row);
  for (const device of devices) {
    await enqueueDeviceCommand(device.id, command);
  }
}

export async function enqueueEmployeeDelete(employeeCode: string): Promise<void> {
  const devices = await getAllDevices();
  if (devices.length === 0) {
    return;
  }

  const command = buildDeleteUserInfoCommand(employeeCode);
  for (const device of devices) {
    await enqueueDeviceCommand(device.id, command);
  }
}

export async function triggerDeviceEmployeePush(
  deviceId: string,
): Promise<DeviceEmployeePushResult> {
  const device = await db.query.zktecoDevices.findFirst({
    where: eq(zktecoDevices.id, deviceId),
  });

  if (!device) {
    return { deviceId, queued: 0 };
  }

  const employeeRows = await getEmployeesWithCompanyForSync();
  for (const employee of employeeRows) {
    await enqueueDeviceCommand(deviceId, buildUpdateUserInfoCommand(employee));
  }

  if (employeeRows.length > 0) {
    await setSyncStateValue(
      syncStateKey("zkteco_last_employee_push_at", deviceId),
      new Date().toISOString(),
    );
  }

  return { deviceId, queued: employeeRows.length };
}

export async function triggerDeviceUserPull(
  deviceId: string,
  options: { pin?: string; force?: boolean } = {},
): Promise<DeviceUserPullResult> {
  const device = await db.query.zktecoDevices.findFirst({
    where: eq(zktecoDevices.id, deviceId),
  });

  if (!device) {
    return { deviceId, queued: false, reason: "device_not_found" };
  }

  if (!options.force && (await hasPendingUserQuery(deviceId))) {
    return { deviceId, queued: false, reason: "query_already_pending" };
  }

  const command = await enqueueDeviceCommand(deviceId, buildQueryUserInfoCommand(options.pin));

  return { deviceId, queued: true, commandId: command.id };
}

/** @deprecated Use triggerDeviceUserPull instead. */
export async function enqueueBootstrapUserQuery(deviceId: string, pin?: string): Promise<void> {
  await triggerDeviceUserPull(deviceId, { pin, force: false });
}

export async function triggerReconcileDeviceSync(deviceId: string): Promise<DeviceSyncResult> {
  const device = await db.query.zktecoDevices.findFirst({
    where: eq(zktecoDevices.id, deviceId),
  });

  if (!device) {
    return {
      deviceId,
      push: { deviceId, queued: 0 },
      pull: { deviceId, queued: false, reason: "device_not_found" },
      companyPush: { deviceId, queued: 0 },
      companyPull: { deviceId, queued: false, reason: "device_not_found" },
    };
  }

  const { triggerDeviceCompanyPull, triggerDeviceCompanyPush } = await import(
    "@/lib/zkteco/company-sync"
  );

  // Pull device state first, then push AMS canonical state (FIFO — one ADMS command per heartbeat).
  const companyPull = await triggerDeviceCompanyPull(deviceId, { force: true });
  const pull = await triggerDeviceUserPull(deviceId, { force: true });
  const companyPush = await triggerDeviceCompanyPush(deviceId);
  const push = await triggerDeviceEmployeePush(deviceId);

  const now = new Date().toISOString();
  await setSyncStateValue(syncStateKey("zkteco_bootstrap_initiated", deviceId), now);
  await setSyncStateValue(syncStateKey("zkteco_last_reconcile_at", deviceId), now);
  await setSyncStateValue(syncStateKey("zkteco_bootstrap_completed", deviceId), "true");

  return { deviceId, push, pull, companyPush, companyPull };
}

export async function triggerFullDeviceSync(
  deviceId: string,
  options: { direction?: SyncDirection; pin?: string; force?: boolean } = {},
): Promise<DeviceSyncResult> {
  const direction = options.direction ?? "both";

  if (direction === "sync") {
    return triggerReconcileDeviceSync(deviceId);
  }

  const { triggerDeviceCompanyPull, triggerDeviceCompanyPush } = await import(
    "@/lib/zkteco/company-sync"
  );

  const includeCompanyPush =
    direction === "both" || direction === "push" || direction === "companies";
  const includeEmployeePush =
    direction === "both" || direction === "push" || direction === "employees";
  const includePull = direction === "both" || direction === "pull";

  const companyPush = includeCompanyPush
    ? await triggerDeviceCompanyPush(deviceId)
    : { deviceId, queued: 0 };
  const push = includeEmployeePush
    ? await triggerDeviceEmployeePush(deviceId)
    : { deviceId, queued: 0 };
  const companyPull = includePull
    ? await triggerDeviceCompanyPull(deviceId, { force: options.force })
    : { deviceId, queued: false as const, reason: "push_only" };
  const pull = includePull
    ? await triggerDeviceUserPull(deviceId, {
        pin: options.pin,
        force: options.force,
      })
    : { deviceId, queued: false as const, reason: "push_only" };

  if (includeCompanyPush || includeEmployeePush) {
    await setSyncStateValue(
      syncStateKey("zkteco_bootstrap_initiated", deviceId),
      new Date().toISOString(),
    );
  }

  if (push.queued > 0 || companyPush.queued > 0 || pull.queued || companyPull.queued) {
    await setSyncStateValue(syncStateKey("zkteco_bootstrap_completed", deviceId), "true");
  }

  return { deviceId, push, pull, companyPush, companyPull };
}

export async function scheduleDeviceBootstrap(deviceId: string): Promise<DeviceSyncResult> {
  const completed = await getSyncStateValue(syncStateKey("zkteco_bootstrap_completed", deviceId));
  if (completed === "true") {
    return {
      deviceId,
      push: { deviceId, queued: 0 },
      pull: { deviceId, queued: false, reason: "bootstrap_already_completed" },
      companyPush: { deviceId, queued: 0 },
      companyPull: { deviceId, queued: false, reason: "bootstrap_already_completed" },
    };
  }

  return triggerFullDeviceSync(deviceId, { direction: "both" });
}

/** @deprecated Use scheduleDeviceBootstrap instead. */
export async function scheduleDeviceUserBootstrap(deviceId: string): Promise<DeviceUserPullResult> {
  const result = await scheduleDeviceBootstrap(deviceId);
  return result.pull;
}

export async function runPeriodicDeviceSync(): Promise<{
  checked: number;
  queued: number;
  skipped: number;
}> {
  const devices = await db.select().from(zktecoDevices);
  const intervalMs = getUserSyncIntervalMs();
  const now = Date.now();

  let queued = 0;
  let skipped = 0;

  for (const device of devices) {
    if (!isDeviceReachable(device.lastSeenAt)) {
      skipped += 1;
      continue;
    }

    const lastSyncRaw = await getSyncStateValue(
      syncStateKey("zkteco_last_user_sync_at", device.id),
    );
    const lastSyncAt = lastSyncRaw ? Date.parse(lastSyncRaw) : 0;
    if (Number.isFinite(lastSyncAt) && now - lastSyncAt < intervalMs) {
      skipped += 1;
      continue;
    }

    const result = await triggerFullDeviceSync(device.id, { direction: "both" });
    if (result.pull.queued || result.push.queued > 0 || result.companyPull.queued) {
      queued += 1;
    } else {
      skipped += 1;
    }
  }

  return { checked: devices.length, queued, skipped };
}

/** @deprecated Use runPeriodicDeviceSync instead. */
export async function runPeriodicDeviceUserSync(): Promise<{
  checked: number;
  queued: number;
  skipped: number;
}> {
  return runPeriodicDeviceSync();
}

export async function ingestUserInfoRecords(
  deviceId: string,
  records: UserInfoRecord[],
): Promise<UserInfoIngestResult> {
  if (records.length === 0) {
    return { processed: 0, matched: 0, created: 0, unmatched: 0 };
  }

  const ctx = await loadEmployeeContext();
  if (!ctx) {
    return { processed: 0, matched: 0, created: 0, unmatched: records.length };
  }

  let matched = 0;
  let created = 0;
  let unmatched = 0;

  for (const record of records) {
    const cardNo = record.card?.trim() || record.pin;
    const name = record.name?.trim() || record.pin;

    let outcome = matchDeviceUser(record, ctx);
    if (!outcome) {
      const employee = await createEmployeeFromDeviceUser(record, cardNo, ctx);
      if (!employee) {
        unmatched += 1;
        continue;
      }
      outcome = {
        employeeId: employee.id,
        matchMethod: "created",
        matchScore: null,
        created: true,
      };
      created += 1;
    } else {
      matched += 1;

      const employee = ctx.byId.get(outcome.employeeId);
      if (employee) {
        const updates: Partial<typeof employees.$inferInsert> = { updatedAt: new Date() };

        if (cardNo && cardNo !== record.pin && !employee.machineCardNo && !ctx.byCard.has(cardNo)) {
          updates.machineCardNo = cardNo;
        }

        const pulledDepartment = record.department?.trim();
        if (pulledDepartment && pulledDepartment !== employee.department) {
          updates.department = pulledDepartment;
        }

        if (Object.keys(updates).length > 1) {
          await db.update(employees).set(updates).where(eq(employees.id, employee.id));
          if (updates.machineCardNo) {
            employee.machineCardNo = updates.machineCardNo;
            ctx.byCard.set(updates.machineCardNo, employee);
          }
          if (updates.department) {
            employee.department = updates.department;
          }
        }
      }
    }

    await upsertBiometricMapping(
      deviceId,
      record,
      cardNo,
      name,
      outcome.employeeId,
      outcome.matchMethod,
      outcome.matchScore,
    );
  }

  const processed = matched + created;
  if (processed > 0) {
    await markUserSyncCompleted(deviceId);
    await relinkMachinePunchesToEmployees();
  }

  return { processed, matched, created, unmatched };
}

export type UnmappedDeviceUser = {
  pin: string;
  cardNo: string;
  machineNo: string | null;
  machineEmpName: string | null;
  punchCount: number;
  lastPunchAt: Date;
};

export async function listUnmappedDeviceUsers(): Promise<UnmappedDeviceUser[]> {
  const punches = await db
    .select({
      cardNo: machinePunches.cardNo,
      machineEmpCode: machinePunches.machineEmpCode,
      machineNo: machinePunches.machineNo,
      machineEmpName: machinePunches.machineEmpName,
      punchAt: machinePunches.punchAt,
    })
    .from(machinePunches)
    .where(and(eq(machinePunches.sourceSystem, "zkteco"), isNull(machinePunches.employeeId)))
    .orderBy(desc(machinePunches.punchAt))
    .limit(1000);

  const grouped = new Map<string, UnmappedDeviceUser>();

  for (const punch of punches) {
    const key = `${punch.cardNo}|${punch.machineNo ?? ""}|${punch.machineEmpCode ?? ""}`;
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        pin: punch.machineEmpCode ?? punch.cardNo,
        cardNo: punch.cardNo,
        machineNo: punch.machineNo,
        machineEmpName: punch.machineEmpName,
        punchCount: 1,
        lastPunchAt: punch.punchAt,
      });
      continue;
    }

    existing.punchCount += 1;
    if (punch.punchAt > existing.lastPunchAt) {
      existing.lastPunchAt = punch.punchAt;
      if (punch.machineEmpName) {
        existing.machineEmpName = punch.machineEmpName;
      }
    }
  }

  return [...grouped.values()].sort(
    (left, right) => right.lastPunchAt.getTime() - left.lastPunchAt.getTime(),
  );
}

export async function listZktecoDevicesWithSyncState() {
  const { getCompanySyncState } = await import("@/lib/zkteco/company-sync");
  const devices = await db.select().from(zktecoDevices).orderBy(desc(zktecoDevices.lastSeenAt));

  return Promise.all(
    devices.map(async (device) => {
      const [lastUserSyncAt, lastEmployeePushAt, bootstrapCompleted, pendingQuery, companySync] =
        await Promise.all([
          getSyncStateValue(syncStateKey("zkteco_last_user_sync_at", device.id)),
          getSyncStateValue(syncStateKey("zkteco_last_employee_push_at", device.id)),
          getSyncStateValue(syncStateKey("zkteco_bootstrap_completed", device.id)),
          hasPendingUserQuery(device.id),
          getCompanySyncState(device.id),
        ]);

      return {
        ...device,
        connectionStatus: getDeviceConnectionStatus(device.lastSeenAt),
        secondsSinceLastSeen: getSecondsSinceLastSeen(device.lastSeenAt),
        lastSeenLabel: formatDeviceLastSeen(device.lastSeenAt),
        isOnline: isDeviceReachable(device.lastSeenAt),
        lastUserSyncAt,
        lastEmployeePushAt,
        lastCompanyPushAt: companySync.lastCompanyPushAt,
        lastCompanySyncAt: companySync.lastCompanySyncAt,
        bootstrapCompleted: bootstrapCompleted === "true",
        userQueryPending: pendingQuery,
      };
    }),
  );
}
