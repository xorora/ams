/**
 * Required server environment variables. Missing values fail closed at read time.
 */

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL is required. Copy .env.example to .env.local and set your Neon PostgreSQL connection string.",
    );
  }
  return url;
}

export function getWorkspaceDomain(): string {
  const hd = process.env.GOOGLE_WORKSPACE_HD?.trim().toLowerCase();
  if (!hd) {
    throw new Error(
      "GOOGLE_WORKSPACE_HD is required. Set your Google Workspace domain (e.g. company.com).",
    );
  }
  return hd;
}

export function assertAuthEnv(): void {
  getWorkspaceDomain();
  if (!process.env.AUTH_SECRET?.trim()) {
    throw new Error("AUTH_SECRET is required.");
  }
  if (!process.env.GOOGLE_CLIENT_ID?.trim() || !process.env.GOOGLE_CLIENT_SECRET?.trim()) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required.");
  }
}
