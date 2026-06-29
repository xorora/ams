export type WdmsPaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  msg: string;
  code: number;
  data: T[];
};

export type WdmsTransaction = {
  id: number;
  emp_code: string;
  first_name: string;
  last_name: string;
  department: string;
  punch_time: string;
  punch_state: string;
  punch_state_display: string;
  verify_type_display: string;
  terminal_sn: string;
  terminal_alias: string;
  upload_time: string;
};

export type WdmsCompanyRef = {
  id: number;
  company_code: string;
  company_name: string;
};

export type WdmsCompany = WdmsCompanyRef;

export type WdmsCreateCompanyPayload = {
  company_code: string;
  company_name: string;
};

export type WdmsCreateAreaPayload = {
  area_code: string;
  area_name: string;
  company: number;
  parent_area?: number | null;
};

export type WdmsDepartment = {
  id: number;
  dept_code: string;
  dept_name: string;
  parent_dept?: number | null;
  company?: WdmsCompanyRef | null;
};

export type WdmsArea = {
  id: number;
  area_code: string;
  area_name: string;
  parent_area?: number | null;
  company?: WdmsCompanyRef | null;
};

export type WdmsCreateDepartmentPayload = {
  dept_code: string;
  dept_name: string;
  company: number;
  parent_dept?: number | null;
};

export type WdmsEmployee = {
  id: number;
  emp_code: string;
  first_name: string;
  last_name: string;
  department?: WdmsDepartment | null;
  app_status: number;
  hire_date?: string | null;
};

export type WdmsTerminal = {
  id: number;
  sn: string;
  alias: string;
  state: string;
  last_activity: string | null;
  ip_address?: string | null;
  firmware_version?: string | null;
};

export type WdmsCreateEmployeePayload = {
  emp_code: string;
  first_name: string;
  last_name: string;
  company: number;
  department?: number;
  area: number[];
  hire_date?: string;
};

export type WdmsClientConfig = {
  baseUrl: string;
  username: string;
  password: string;
};
