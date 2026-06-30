export type ZktimeClientConfig = {
  baseUrl: string;
  apiKey: string;
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
  verify_type_display?: string | null;
  full_name?: string | null;
};

export type ZktimeTransactionsExportResponse = {
  transactions: ZktimeTransaction[];
  latestUploadTime: string | null;
};

export type ZktimeEmployee = {
  emp_code: string;
  full_name: string;
  department_id?: number | null;
  department_name?: string | null;
  enabled?: boolean | null;
};

export type ZktimeEmployeesResponse = {
  employees: ZktimeEmployee[];
};

export type ZktimePushEmployeePayload = {
  emp_code: string;
  full_name: string;
  department_id?: number | null;
};

export type ZktimePushEmployeesRequest = {
  employees: ZktimePushEmployeePayload[];
};

export type ZktimePushEmployeesResponse = {
  pushed: number;
  queued?: number;
  failures?: Array<{ emp_code: string; message: string }>;
};

export type ZktimeTerminal = {
  serial_number: string;
  alias?: string | null;
  ip_address?: string | null;
  firmware_version?: string | null;
  last_seen_at?: string | null;
};

export type ZktimeTerminalsResponse = {
  terminals: ZktimeTerminal[];
};
