import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { companies, syncState, zktecoDeviceCommands, zktecoDevices } from "@/db/schema";
import { buildQueryDeptInfoCommand, buildUpdateDeptInfoCommand } from "@/lib/zkteco/adms/commands";
import type { DeptInfoRecord } from "@/lib/zkteco/adms/parser";
import { getZktecoDefaultCompanySlug, shouldSyncAllCompanies } from "@/lib/zkteco/config";
import { enqueueDeviceCommand } from "@/lib/zkteco/device-service";

export type CompanyPullResult = {
  deviceId: string;
  queued: boolean;
  reason?: string;
  commandId?: string;
};

export type CompanyPushResult = {
  deviceId: string;
  queued: number;
};

function syncStateKey(prefix: string, deviceId: string): string {
  return `${prefix}:${deviceId}`;
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

async function hasPendingDeptQuery(deviceId: string): Promise<boolean> {
  const commands = await db.query.zktecoDeviceCommands.findMany({
    where: and(
      eq(zktecoDeviceCommands.deviceId, deviceId),
      inArray(zktecoDeviceCommands.status, ["pending", "sent"]),
    ),
  });

  return commands.some((command) => command.commandText.includes("QUERY DEPTINFO"));
}

export async function getCompaniesToSync(): Promise<Array<typeof companies.$inferSelect>> {
  if (shouldSyncAllCompanies()) {
    return db
      .select()
      .from(companies)
      .where(eq(companies.isActive, true))
      .orderBy(asc(companies.name));
  }

  const slug = getZktecoDefaultCompanySlug();
  const company = await db.query.companies.findFirst({
    where: eq(companies.slug, slug),
  });

  return company ? [company] : [];
}

function companyDeptId(index: number): string {
  return String(index + 1);
}

export async function triggerDeviceCompanyPush(deviceId: string): Promise<CompanyPushResult> {
  const companiesToSync = await getCompaniesToSync();
  let queued = 0;

  for (const [index, company] of companiesToSync.entries()) {
    await enqueueDeviceCommand(
      deviceId,
      buildUpdateDeptInfoCommand(companyDeptId(index), company.name),
    );
    queued += 1;
  }

  if (queued > 0) {
    await setSyncStateValue(
      syncStateKey("zkteco_last_company_push_at", deviceId),
      new Date().toISOString(),
    );
  }

  return { deviceId, queued };
}

export async function triggerDeviceCompanyPull(
  deviceId: string,
  options: { force?: boolean } = {},
): Promise<CompanyPullResult> {
  const device = await db.query.zktecoDevices.findFirst({
    where: eq(zktecoDevices.id, deviceId),
  });

  if (!device) {
    return { deviceId, queued: false, reason: "device_not_found" };
  }

  if (!options.force && (await hasPendingDeptQuery(deviceId))) {
    return { deviceId, queued: false, reason: "query_already_pending" };
  }

  const command = await enqueueDeviceCommand(deviceId, buildQueryDeptInfoCommand());
  return { deviceId, queued: true, commandId: command.id };
}

export async function ingestDeptInfoRecords(
  deviceId: string,
  records: DeptInfoRecord[],
): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  const amsCompanies = await getCompaniesToSync();
  const byName = new Map(amsCompanies.map((company) => [company.name.toLowerCase(), company]));
  let processed = 0;

  for (const record of records) {
    const match = byName.get(record.deptName.toLowerCase());
    if (!match) {
      const [created] = await db
        .insert(companies)
        .values({
          name: record.deptName,
          slug:
            record.deptName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || `dept-${record.deptId}`,
        })
        .onConflictDoNothing()
        .returning();

      if (created) {
        processed += 1;
      }
      continue;
    }

    processed += 1;
  }

  if (processed > 0) {
    await setSyncStateValue(
      syncStateKey("zkteco_last_company_sync_at", deviceId),
      new Date().toISOString(),
    );
  }

  return processed;
}

export async function markCompanyPullCompleted(deviceId: string): Promise<void> {
  await setSyncStateValue(
    syncStateKey("zkteco_last_company_sync_at", deviceId),
    new Date().toISOString(),
  );
}

export async function getCompanySyncState(deviceId: string) {
  const [lastCompanyPushAt, lastCompanySyncAt] = await Promise.all([
    getSyncStateValue(syncStateKey("zkteco_last_company_push_at", deviceId)),
    getSyncStateValue(syncStateKey("zkteco_last_company_sync_at", deviceId)),
  ]);

  return { lastCompanyPushAt, lastCompanySyncAt };
}
