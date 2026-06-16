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

export function assertAuthEnv(): void {
  if (!process.env.AUTH_SECRET?.trim()) {
    throw new Error("AUTH_SECRET is required.");
  }
}
