import {
  getWdmsBaseUrl,
  getWdmsPassword,
  getWdmsUsername,
  isWdmsConfigured,
} from "@/lib/wdms/config";
import type {
  WdmsArea,
  WdmsClientConfig,
  WdmsCompany,
  WdmsCreateAreaPayload,
  WdmsCreateCompanyPayload,
  WdmsCreateDepartmentPayload,
  WdmsCreateEmployeePayload,
  WdmsDepartment,
  WdmsEmployee,
  WdmsPaginatedResponse,
  WdmsTerminal,
  WdmsTransaction,
} from "@/lib/wdms/types";

type TokenResponse = { token: string };

export class WdmsClient {
  private readonly baseUrl: string;
  private readonly username: string;
  private readonly password: string;
  private token: string | null = null;

  constructor(config: WdmsClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.username = config.username;
    this.password = config.password;
  }

  static fromEnv(): WdmsClient {
    const baseUrl = getWdmsBaseUrl();
    const username = getWdmsUsername();
    const password = getWdmsPassword();

    if (!baseUrl || !username || !password) {
      throw new Error(
        "WDMS is not configured. Set WDMS_BASE_URL, WDMS_USERNAME, and WDMS_PASSWORD.",
      );
    }

    return new WdmsClient({ baseUrl, username, password });
  }

  static tryFromEnv(): WdmsClient | null {
    if (!isWdmsConfigured()) {
      return null;
    }
    return WdmsClient.fromEnv();
  }

  private async authenticate(): Promise<string> {
    const response = await fetch(`${this.baseUrl}/api-token-auth/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WDMS authentication failed (${response.status}): ${body}`);
    }

    const data = (await response.json()) as TokenResponse;
    if (!data.token) {
      throw new Error("WDMS authentication response missing token");
    }

    this.token = data.token;
    return data.token;
  }

  private async getToken(): Promise<string> {
    if (this.token) {
      return this.token;
    }
    return this.authenticate();
  }

  private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
    const token = await this.getToken();
    const url = path.startsWith("http")
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Token ${token}`,
        ...init.headers,
      },
    });

    if (response.status === 401 && retry) {
      this.token = null;
      await this.authenticate();
      return this.request<T>(path, init, false);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`WDMS request failed (${response.status}) ${path}: ${body}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async fetchAllPages<T>(initialPath: string, pageSize = 500): Promise<T[]> {
    const items: T[] = [];
    let path: string | null = initialPath;

    while (path) {
      const pageUrl: string = path.startsWith("http")
        ? path
        : `${path}${path.includes("?") ? "&" : "?"}page_size=${pageSize}`;

      const response: WdmsPaginatedResponse<T> =
        await this.request<WdmsPaginatedResponse<T>>(pageUrl);
      items.push(...response.data);
      path = response.next;
    }

    return items;
  }

  async getTransactions(
    params: {
      page?: number;
      pageSize?: number;
      uploadTimeMoreThan?: string;
      ordering?: string;
    } = {},
  ): Promise<WdmsPaginatedResponse<WdmsTransaction>> {
    const search = new URLSearchParams();
    search.set("page", String(params.page ?? 1));
    search.set("page_size", String(params.pageSize ?? 500));
    if (params.uploadTimeMoreThan) {
      search.set("upload_time_more_than", params.uploadTimeMoreThan);
    }
    if (params.ordering) {
      search.set("ordering", params.ordering);
    }

    return this.request<WdmsPaginatedResponse<WdmsTransaction>>(
      `/iclock/api/transactions/?${search.toString()}`,
    );
  }

  async getAllTransactionsSince(since: string): Promise<WdmsTransaction[]> {
    const search = new URLSearchParams({
      upload_time_more_than: since,
      ordering: "upload_time",
    });

    return this.fetchAllPages<WdmsTransaction>(`/iclock/api/transactions/?${search.toString()}`);
  }

  async getEmployees(params: { page?: number; pageSize?: number; status?: number } = {}) {
    const search = new URLSearchParams();
    search.set("page", String(params.page ?? 1));
    search.set("page_size", String(params.pageSize ?? 500));
    if (params.status !== undefined) {
      search.set("status", String(params.status));
    }

    return this.request<WdmsPaginatedResponse<WdmsEmployee>>(
      `/personnel/api/employees/?${search.toString()}`,
    );
  }

  async getAllEmployees(_pageSize = 500): Promise<WdmsEmployee[]> {
    return this.fetchAllPages<WdmsEmployee>("/personnel/api/employees/?ordering=emp_code");
  }

  async getDepartments(): Promise<WdmsPaginatedResponse<WdmsDepartment>> {
    return this.request<WdmsPaginatedResponse<WdmsDepartment>>(
      "/personnel/api/departments/?page_size=500",
    );
  }

  async getAllCompanies(): Promise<WdmsCompany[]> {
    return this.fetchAllPages<WdmsCompany>("/personnel/api/company/");
  }

  async createCompany(payload: WdmsCreateCompanyPayload): Promise<WdmsCompany> {
    return this.request<WdmsCompany>("/personnel/api/company/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getAllDepartments(): Promise<WdmsDepartment[]> {
    return this.fetchAllPages<WdmsDepartment>("/personnel/api/departments/");
  }

  async createDepartment(payload: WdmsCreateDepartmentPayload): Promise<WdmsDepartment> {
    return this.request<WdmsDepartment>("/personnel/api/departments/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getAllAreas(): Promise<WdmsArea[]> {
    return this.fetchAllPages<WdmsArea>("/personnel/api/areas/");
  }

  async createArea(payload: WdmsCreateAreaPayload): Promise<WdmsArea> {
    return this.request<WdmsArea>("/personnel/api/areas/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async getEmployeeByCode(empCode: string, companyId?: number): Promise<WdmsEmployee | null> {
    const search = new URLSearchParams({
      emp_code: empCode,
      page_size: "1",
    });
    if (companyId !== undefined) {
      search.set("company", String(companyId));
    }

    const response = await this.request<WdmsPaginatedResponse<WdmsEmployee>>(
      `/personnel/api/employees/?${search.toString()}`,
    );
    return response.data[0] ?? null;
  }

  async createEmployee(payload: WdmsCreateEmployeePayload): Promise<WdmsEmployee> {
    return this.request<WdmsEmployee>("/personnel/api/employees/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async deleteResource(path: string): Promise<void> {
    await this.request<void>(path, { method: "DELETE" });
  }

  async deleteEmployee(id: number): Promise<void> {
    await this.deleteResource(`/personnel/api/employees/${id}/`);
  }

  async deleteDepartment(id: number): Promise<void> {
    await this.deleteResource(`/personnel/api/departments/${id}/`);
  }

  async deleteArea(id: number): Promise<void> {
    await this.deleteResource(`/personnel/api/areas/${id}/`);
  }

  async deleteCompany(id: number): Promise<void> {
    await this.deleteResource(`/personnel/api/company/${id}/`);
  }

  async getTerminals(): Promise<WdmsPaginatedResponse<WdmsTerminal>> {
    return this.request<WdmsPaginatedResponse<WdmsTerminal>>(
      "/iclock/api/terminals/?page_size=500",
    );
  }

  async getAllTerminals(): Promise<WdmsTerminal[]> {
    return this.fetchAllPages<WdmsTerminal>("/iclock/api/terminals/");
  }
}
