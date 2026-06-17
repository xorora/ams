/**
 * Packages scripts/ into generated/sync-agent/bundle.zip for Windows auto-updates.
 * Run before `next build` (see package.json).
 */

import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SCRIPTS_DIR = path.join(ROOT, "scripts");
const OUT_DIR = path.join(ROOT, "generated", "sync-agent");
const STAGING_DIR = path.join(OUT_DIR, "staging");
const APP_STAGING = path.join(STAGING_DIR, "app");
const BUNDLE_PATH = path.join(OUT_DIR, "bundle.zip");
const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");
const INIT_PY = path.join(SCRIPTS_DIR, "ebio_sync", "__init__.py");

const INCLUDE_PATHS = ["ebio_sync", "ebio_sync.py", "requirements.txt", "update.ps1"];

function readVersion() {
  const content = readFileSync(INIT_PY, "utf8");
  const match = content.match(/__version__\s*=\s*["']([^"']+)["']/);
  if (!match) {
    throw new Error(`Could not parse __version__ from ${INIT_PY}`);
  }
  return match[1];
}

function readRequirementsHash() {
  const reqPath = path.join(SCRIPTS_DIR, "requirements.txt");
  const content = readFileSync(reqPath, "utf8");
  return createHash("sha256").update(content).digest("hex");
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(readFileSync(filePath));
  return hash.digest("hex");
}

function stageBundleFiles() {
  rmSync(STAGING_DIR, { recursive: true, force: true });
  mkdirSync(APP_STAGING, { recursive: true });

  for (const includePath of INCLUDE_PATHS) {
    const source = path.join(SCRIPTS_DIR, includePath);
    const target = path.join(APP_STAGING, includePath);
    cpSync(source, target, {
      recursive: true,
      filter: (src) => {
        const base = path.basename(src);
        if (base === "__pycache__" || base.endsWith(".pyc")) {
          return false;
        }
        if (base === ".env" || base === ".env.example") {
          return false;
        }
        return true;
      },
    });
  }
}

function createZipBundle() {
  rmSync(BUNDLE_PATH, { force: true });
  execSync(`zip -rq "${BUNDLE_PATH}" app`, {
    cwd: STAGING_DIR,
    stdio: "inherit",
  });
}

function main() {
  const version = readVersion();
  const requirementsHash = readRequirementsHash();

  mkdirSync(OUT_DIR, { recursive: true });
  stageBundleFiles();
  createZipBundle();

  const sha256 = sha256File(BUNDLE_PATH);
  const bundleStat = statSync(BUNDLE_PATH);

  const manifest = {
    version,
    sha256,
    size_bytes: bundleStat.size,
    requirements_hash: requirementsHash,
    generated_at: new Date().toISOString(),
  };

  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  rmSync(STAGING_DIR, { recursive: true, force: true });

  console.log(
    `[sync-agent] Packaged v${version} (${bundleStat.size} bytes, sha256=${sha256.slice(0, 12)}…)`,
  );
}

try {
  main();
} catch (error) {
  console.error("[sync-agent] Bundle packaging failed:", error);
  process.exit(1);
}
