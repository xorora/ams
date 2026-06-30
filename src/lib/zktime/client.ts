import { getZktimeApiKey, getZktimeBaseUrl, isZktimeConfigured } from "@/lib/zktime/config";
import type {
  ZktimeClientConfig,
  ZktimeEmployee,
  ZktimeEmployeesResponse,
  ZktimePushEmployeesRequest,
  ZktimePushEmployeesResponse,
  ZktimeTerminal,
  ZktimeTerminalsResponse,
  ZktimeTransaction,
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

  async getHealth(): Promise<{ ok?: boolean; status?: string }> {
    return this.request<{ ok?: boolean; status?: string }>("/api/v1/health");
  }

  async exportTransactions(since: string): Promise<ZktimeTransactionsExportResponse> {
    const search = new URLSearchParams({ since });
    const response = await this.request<ZktimeTransactionsExportResponse | ZktimeTransaction[]>(
      `/api/v1/transactions/export?${search.toString()}`,
    );

    if (Array.isArray(response)) {
      const latestUploadTime = response.at(-1)?.upload_time ?? null;
      return { transactions: response, latestUploadTime };
    }

    return {
      transactions: response.transactions ?? [],
      latestUploadTime:
        response.latestUploadTime ?? response.transactions?.at(-1)?.upload_time ?? null,
    };
  }

  async getEmployees(): Promise<ZktimeEmployee[]> {
    const response = await this.request<ZktimeEmployeesResponse | ZktimeEmployee[]>(
      "/api/v1/employees",
    );

    return Array.isArray(response) ? response : (response.employees ?? []);
  }

  async pushEmployees(payload: ZktimePushEmployeesRequest): Promise<ZktimePushEmployeesResponse> {
    return this.request<ZktimePushEmployeesResponse>("/api/v1/employees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async getTerminals(): Promise<ZktimeTerminal[]> {
    const response = await this.request<ZktimeTerminalsResponse | ZktimeTerminal[]>(
      "/api/v1/terminals",
    );

    return Array.isArray(response) ? response : (response.terminals ?? []);
  }
}
