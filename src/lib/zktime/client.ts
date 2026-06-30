import { getZktimeApiKey, getZktimeBaseUrl, isZktimeConfigured } from "@/lib/zktime/config";
import type {
  ZktimeClientConfig,
  ZktimeDepartment,
  ZktimeDeviceSyncRequest,
  ZktimeDeviceSyncResponse,
  ZktimeEmployee,
  ZktimeEmployeeUpsertRequest,
  ZktimeEmployeeUpsertResponse,
  ZktimeMasterDataSyncRequest,
  ZktimeMasterDataSyncResponse,
  ZktimePaginatedResponse,
  ZktimeTerminal,
  ZktimeTransaction,
  ZktimeTransactionsExportPageResponse,
  ZktimeTransactionsExportResponse,
} from "@/lib/zktime/types";

export class ZktimeClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ZktimeClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, "");
    this.apiKey = config.apiKey;
  }

  static fromEnv(): ZktimeClient {
    const baseUrl = getZktimeBaseUrl();
    const apiKey = getZktimeApiKey();

    if (!baseUrl || !apiKey) {
      throw new Error("ZKTime is not configured. Set ZKTIME_BASE_URL and ZKTIME_API_KEY.");
    }

    return new ZktimeClient({ baseUrl, apiKey });
  }

  static tryFromEnv(): ZktimeClient | null {
    if (!isZktimeConfigured()) {
      return null;
    }
    return ZktimeClient.fromEnv();
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const url = path.startsWith("http")
      ? path
      : `${this.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json",
        ...init.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ZKTime request failed (${response.status}) ${path}: ${body}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      const body = await response.text();
      throw new Error(`ZKTime response was not JSON for ${path}: ${body.slice(0, 200)}`);
    }

    return (await response.json()) as T;
  }

  private appendPageSize(path: string, pageSize: number): string {
    if (path.includes("page_size=")) {
      return path;
    }
    const separator = path.includes("?") ? "&" : "?";
    return `${path}${separator}page_size=${pageSize}`;
  }

  private async fetchAllPages<T>(initialPath: string, pageSize = 500): Promise<T[]> {
    const items: T[] = [];
    let path: string | null = initialPath;

    while (path) {
      const pageUrl = this.appendPageSize(path, pageSize);

      const response: ZktimePaginatedResponse<T> =
        await this.request<ZktimePaginatedResponse<T>>(pageUrl);
      items.push(...response.data);
      path = response.next;
    }

    return items;
  }

  async getHealth(): Promise<{ ok?: boolean; status?: string }> {
    return this.request<{ ok?: boolean; status?: string }>("/api/v1/health");
  }

  async exportTransactions(since: string): Promise<ZktimeTransactionsExportResponse> {
    const search = new URLSearchParams({ since });
    const initialPath = `/api/v1/transactions/export?${search.toString()}`;
    const transactions: ZktimeTransaction[] = [];
    let path: string | null = initialPath;
    let nextSince: string | null = null;

    while (path) {
      const pageUrl = this.appendPageSize(path, 500);
      const response = await this.request<ZktimeTransactionsExportPageResponse>(pageUrl);

      if (response.next_since) {
        nextSince = response.next_since;
      }

      transactions.push(...response.data);
      path = response.next;
    }

    return {
      transactions,
      nextSince,
    };
  }

  async getAllTransactionsSince(since: string): Promise<ZktimeTransaction[]> {
    const { transactions } = await this.exportTransactions(since);
    return transactions;
  }

  async getAllDepartments(): Promise<ZktimeDepartment[]> {
    return this.fetchAllPages<ZktimeDepartment>("/api/v1/departments");
  }

  async getEmployees(): Promise<ZktimeEmployee[]> {
    return this.fetchAllPages<ZktimeEmployee>("/api/v1/employees");
  }

  async getAllEmployees(pageSize = 500): Promise<ZktimeEmployee[]> {
    return this.fetchAllPages<ZktimeEmployee>("/api/v1/employees", pageSize);
  }

  async upsertEmployee(
    payload: ZktimeEmployeeUpsertRequest,
  ): Promise<ZktimeEmployeeUpsertResponse> {
    return this.request<ZktimeEmployeeUpsertResponse>("/api/v1/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async syncMasterData(
    payload: ZktimeMasterDataSyncRequest,
  ): Promise<ZktimeMasterDataSyncResponse> {
    return this.request<ZktimeMasterDataSyncResponse>("/api/v1/sync/master-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async syncEmployeesToDevice(
    payload: ZktimeDeviceSyncRequest = {},
  ): Promise<ZktimeDeviceSyncResponse> {
    return this.request<ZktimeDeviceSyncResponse>("/api/v1/employees/sync-to-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async getTerminals(): Promise<ZktimeTerminal[]> {
    return this.fetchAllPages<ZktimeTerminal>("/api/v1/terminals");
  }
}
