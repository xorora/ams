export type ZktimeClientConfig = {
  baseUrl: string;
  apiKey: string;
};

export type ZktimePaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  msg: string;
  code: number;
  data: T[];
};

export type ZktimeTransaction = {
  id: number;
  emp_code: string;
  punch_time: string;
  upload_time: string;
  terminal_sn?: string | null;
  terminal_alias?: string | null;
  punch_state?: string | null;
  punch_state_display?: string | null;
  verify_type?: number | null;
  verify_type_display?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  department?: string | null;
};

export type ZktimeTransactionsExportPageResponse = ZktimePaginatedResponse<ZktimeTransaction> & {
  since_requested?: string;
  since_parsed_local?: string;
  latest_punch_time?: string;
  next_since?: string;
};

export type ZktimeTransactionsExportResponse = {
  transactions: ZktimeTransaction[];
  nextSince: string | null;
};

export type ZktimeDepartment = {
  id: number;
  dept_code: string;
  dept_name: string;
  ams_id?: number | null;
};

export type ZktimeEmployee = {
  id: number;
  emp_code: string;
  first_name: string;
  last_name: string;
  full_name: string;
  department?: ZktimeDepartment | null;
  hire_date?: string | null;
  app_status?: number | null;
};

export type ZktimeEmployeeUpsertRequest = {
  emp_code: string;
  full_name: string;
  department_id?: number;
  ams_department_id?: number;
  department_name?: string;
};

export type ZktimeDepartmentSyncRequest = {
  ams_id: number;
  name: string;
};

export type ZktimeMasterDataSyncRequest = {
  departments?: ZktimeDepartmentSyncRequest[];
  employees: ZktimeEmployeeUpsertRequest[];
  queue_to_device?: boolean;
};

export type ZktimeEmployeeSyncAction = "created" | "updated" | "unchanged";

export type ZktimeEmployeeSyncResultItem = {
  emp_code: string;
  full_name: string;
  sync_action: ZktimeEmployeeSyncAction;
  queued_for_device: boolean;
};

export type ZktimeMasterDataSyncResponse = {
  msg?: string;
  code?: number;
  departments_synced?: number;
  employees_synced?: number;
  queued?: number;
  queuedForDevice?: number;
  skipped_unchanged?: number;
  skippedUnchanged?: number;
  failures?: Array<{ emp_code: string; message: string }>;
  employees?: Array<{
    emp_code: string;
    full_name: string;
    sync_action?: ZktimeEmployeeSyncAction | string;
    queued_for_device?: boolean;
    queuedForDevice?: boolean;
  }>;
  [key: string]: unknown;
};

export type NormalizedMasterDataSyncResult = {
  departmentsSynced: number;
  employeesSynced: number;
  queuedForDevice: number;
  skippedUnchanged: number;
  failures: Array<{ emp_code: string; message: string }>;
  employees: ZktimeEmployeeSyncResultItem[];
};

function readNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  return undefined;
}

function isSyncAction(value: unknown): value is ZktimeEmployeeSyncAction {
  return value === "created" || value === "updated" || value === "unchanged";
}

export function normalizeMasterDataSyncResponse(
  result: ZktimeMasterDataSyncResponse,
): NormalizedMasterDataSyncResult {
  const failures = Array.isArray(result.failures)
    ? result.failures.filter((failure): failure is { emp_code: string; message: string } =>
        Boolean(
          failure &&
            typeof failure === "object" &&
            typeof failure.emp_code === "string" &&
            typeof failure.message === "string",
        ),
      )
    : [];

  const employees = Array.isArray(result.employees)
    ? result.employees
        .filter((employee): employee is NonNullable<typeof employee> =>
          Boolean(
            employee &&
              typeof employee === "object" &&
              typeof employee.emp_code === "string" &&
              typeof employee.full_name === "string",
          ),
        )
        .map((employee) => ({
          emp_code: employee.emp_code,
          full_name: employee.full_name,
          sync_action: isSyncAction(employee.sync_action) ? employee.sync_action : "updated",
          queued_for_device: Boolean(employee.queued_for_device ?? employee.queuedForDevice),
        }))
    : [];

  return {
    departmentsSynced: readNumber(result.departments_synced) ?? 0,
    employeesSynced: readNumber(result.employees_synced) ?? 0,
    queuedForDevice: readNumber(result.queuedForDevice, result.queued) ?? 0,
    skippedUnchanged: readNumber(result.skippedUnchanged, result.skipped_unchanged) ?? 0,
    failures,
    employees,
  };
}

export type ZktimeEmployeeUpsertResponse = {
  msg: string;
  code: number;
  data: ZktimeEmployee;
};

export type ZktimeDeviceSyncRequest = {
  emp_codes?: string[] | null;
};

export type ZktimeDeviceSyncResponse = {
  msg: string;
  code: number;
  queued: number;
};

/** @deprecated Use ZktimeEmployeeUpsertRequest */
export type ZktimePushEmployeePayload = ZktimeEmployeeUpsertRequest;

export type ZktimePushEmployeesRequest = {
  employees: ZktimeEmployeeUpsertRequest[];
};

export type ZktimePushEmployeesResponse = {
  pushed: number;
  queued: number;
  failures: Array<{ emp_code: string; message: string }>;
};

export type ZktimeTerminal = {
  id?: number | null;
  /** Device serial from bridge v1.1+ (`sn` in API). */
  sn?: string | null;
  serial_number?: string | null;
  terminal_sn?: string | null;
  alias?: string | null;
  ip_address?: string | null;
  port?: number | null;
  machine_number?: number | null;
  enabled?: boolean | null;
  firmware_version?: string | null;
  state?: number | null;
  last_activity?: string | null;
  last_seen_at?: string | null;
};

export type OrganizationalPushResult = {
  companies: number;
  departmentsMapped: number;
  rolesTracked: number;
  employeesPushed: number;
  employeesFailed: number;
  deviceSyncQueued: number;
  skippedUnchanged: number;
  failures: Array<{ emp_code: string; message: string }>;
  employees: ZktimeEmployeeSyncResultItem[];
  notes: string[];
};
