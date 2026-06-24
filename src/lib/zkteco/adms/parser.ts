export type AttlogRecord = {
  pin: string;
  datetime: string;
  status: number;
  verify: number;
  workcode: number;
  rawLine: string;
};

export type DeviceCommandResult = {
  id: string;
  returnCode: number;
  command: string;
};

export type UserInfoRecord = {
  pin: string;
  name?: string;
  card?: string;
  department?: string;
  privilege?: string;
  rawLine: string;
};

export type DeptInfoRecord = {
  deptId: string;
  deptName: string;
  rawLine: string;
};

const ATTLOG_DATETIME_RE = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/;

/** ADMS ATTLOG line: `{pin}\t{datetime}\t{status}\t{verify}\t{workcode}\t{reserved}` */
export function parseAttlogLine(line: string): AttlogRecord | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const fields = trimmed.split("\t");
  if (fields.length >= 5) {
    const [pin, datetime, statusRaw, verifyRaw, workcodeRaw] = fields;
    if (!pin || !datetime || !ATTLOG_DATETIME_RE.test(datetime)) {
      return null;
    }

    return {
      pin: pin.trim(),
      datetime: datetime.trim(),
      status: Number.parseInt(statusRaw, 10),
      verify: Number.parseInt(verifyRaw, 10),
      workcode: Number.parseInt(workcodeRaw, 10),
      rawLine: trimmed,
    };
  }

  // Some firmware sends space-separated fields instead of tabs.
  const match = trimmed.match(
    /^(\S+)\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\s+(\d+)\s+(\d+)\s+(\d+)/,
  );
  if (!match) {
    return null;
  }

  return {
    pin: match[1],
    datetime: match[2],
    status: Number.parseInt(match[3], 10),
    verify: Number.parseInt(match[4], 10),
    workcode: Number.parseInt(match[5], 10),
    rawLine: trimmed,
  };
}

export function parseAttlogBody(body: string): AttlogRecord[] {
  const records: AttlogRecord[] = [];

  for (const line of body.split(/\r?\n/)) {
    const record = parseAttlogLine(line);
    if (record) {
      records.push(record);
    }
  }

  return records;
}

export function parseDeviceCmdBody(body: string): DeviceCommandResult[] {
  const results: DeviceCommandResult[] = [];

  for (const chunk of body.split(/\r?\n/)) {
    const trimmed = chunk.trim();
    if (!trimmed) {
      continue;
    }

    const params = new URLSearchParams(trimmed.replace(/&/g, "&"));
    const id = params.get("ID");
    const returnRaw = params.get("Return");
    const command = params.get("CMD") ?? "";

    if (!id || returnRaw === null) {
      continue;
    }

    results.push({
      id,
      returnCode: Number.parseInt(returnRaw, 10),
      command,
    });
  }

  return results;
}

function parseKeyValueFields(segment: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const part of segment.split("\t")) {
    const eq = part.indexOf("=");
    if (eq === -1) {
      continue;
    }
    fields[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }
  return fields;
}

export function parseUserInfoBody(body: string): UserInfoRecord[] {
  const records: UserInfoRecord[] = [];

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    // USER PIN=123\tName=John\tCard=456...
    const userMatch = trimmed.match(/^USER\s+(.+)$/i);
    if (userMatch) {
      const fields = parseKeyValueFields(userMatch[1]);
      if (fields.PIN) {
        records.push({
          pin: fields.PIN,
          name: fields.Name,
          card: fields.Card,
          department: fields.Dept,
          privilege: fields.Pri,
          rawLine: trimmed,
        });
      }
      continue;
    }

    // Tab-separated key=value user rows from QUERY USERINFO responses.
    if (trimmed.includes("PIN=")) {
      const fields = parseKeyValueFields(trimmed);
      if (fields.PIN) {
        records.push({
          pin: fields.PIN,
          name: fields.Name,
          card: fields.Card,
          department: fields.Dept,
          privilege: fields.Pri,
          rawLine: trimmed,
        });
      }
    }
  }

  return records;
}

export function parseDeptInfoBody(body: string): DeptInfoRecord[] {
  const records: DeptInfoRecord[] = [];

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const deptMatch = trimmed.match(/^DEPT\s+(.+)$/i);
    const segment = deptMatch?.[1] ?? trimmed;
    if (!segment.includes("DEPTID=")) {
      continue;
    }

    const fields = parseKeyValueFields(segment);
    const deptId = fields.DEPTID;
    const deptName = fields.DEPTNAME;
    if (deptId && deptName) {
      records.push({ deptId, deptName, rawLine: trimmed });
    }
  }

  return records;
}

export function parseRegistryBody(body: string): Record<string, string> {
  const info: Record<string, string> = {};

  for (const part of body.split(/[,\n]/)) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    info[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }

  return info;
}

export function extractWireCommandId(commandText: string): string | null {
  const match = commandText.match(/^C:([^:]+):/);
  return match?.[1] ?? null;
}
