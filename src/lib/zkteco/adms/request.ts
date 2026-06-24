import { getZktecoDeviceToken } from "@/lib/zkteco/config";

const SERIAL_NUMBER_RE = /^[A-Za-z0-9_-]{4,64}$/;

export function getSerialNumber(request: Request): string | null {
  const url = new URL(request.url);
  const sn = url.searchParams.get("SN")?.trim();
  if (!sn || !SERIAL_NUMBER_RE.test(sn)) {
    return null;
  }
  return sn;
}

export function getQueryParam(request: Request, name: string): string | null {
  const value = new URL(request.url).searchParams.get(name)?.trim();
  return value || null;
}

/** Admin verify scripts and connectivity probes — must not update device last_seen_at. */
export function isAdmsProbeRequest(request: Request): boolean {
  if (request.headers.get("x-zkteco-probe") === "1") {
    return true;
  }
  return getQueryParam(request, "probe") === "1";
}

export function validateDeviceAuth(request: Request): boolean {
  const expectedToken = getZktecoDeviceToken();
  if (!expectedToken) {
    return true;
  }

  const pushCommKey = getQueryParam(request, "pushcommkey");
  if (pushCommKey && pushCommKey === expectedToken) {
    return true;
  }

  const stamp = getQueryParam(request, "Stamp");
  if (stamp && stamp === expectedToken) {
    return true;
  }

  return false;
}

export async function readBodyText(request: Request, maxBytes = 2 * 1024 * 1024): Promise<string> {
  const raw = await request.text();
  if (raw.length > maxBytes) {
    throw new Error("Request body too large");
  }
  return raw;
}
