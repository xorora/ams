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

export type ZktimeTransactionsExportResponse = {
  transactions: ZktimeTransaction[];
  latestUploadTime: string | null;
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

export type ZktimeMasterDataSyncResponse = {
  msg?: string;
  code?: number;
  departments_synced?: number;
  employees_synced?: number;
  queued?: number;
  failures?: Array<{ emp_code: string; message: string }>;
  [key: string]: unknown;
};

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
  failures: Array<{ emp_code: string; message: string }>;
  notes: string[];
};
