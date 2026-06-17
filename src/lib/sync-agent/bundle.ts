import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export type SyncAgentManifest = {
  version: string;
  sha256: string;
  size_bytes: number;
  requirements_hash: string;
  generated_at: string;
};

const GENERATED_DIR = path.join(process.cwd(), "generated", "sync-agent");
const MANIFEST_PATH = path.join(GENERATED_DIR, "manifest.json");
const BUNDLE_PATH = path.join(GENERATED_DIR, "bundle.zip");

export function verifyUpdateToken(request: Request): boolean {
  const secret = process.env.EBIO_UPDATE_TOKEN?.trim();
  if (!secret) {
    return false;
  }

  const auth = request.headers.get("authorization");
  if (auth === `Bearer ${secret}`) {
    return true;
  }

  const headerToken = request.headers.get("x-ebio-update-token");
  return headerToken === secret;
}

export function loadSyncAgentManifest(): SyncAgentManifest | null {
  try {
    const raw = readFileSync(MANIFEST_PATH, "utf8");
    return JSON.parse(raw) as SyncAgentManifest;
  } catch {
    return null;
  }
}

export function loadSyncAgentBundle(): Buffer | null {
  try {
    const bundle = readFileSync(BUNDLE_PATH);
    const manifest = loadSyncAgentManifest();
    if (!manifest) {
      return null;
    }

    const sha256 = createHash("sha256").update(bundle).digest("hex");
    if (sha256 !== manifest.sha256) {
      console.error("[sync-agent] Bundle sha256 mismatch");
      return null;
    }

    return bundle;
  } catch {
    return null;
  }
}
