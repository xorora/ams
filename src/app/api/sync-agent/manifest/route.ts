import { NextResponse } from "next/server";
import { loadSyncAgentManifest } from "@/lib/sync-agent/bundle";

export async function GET() {
  const manifest = loadSyncAgentManifest();
  if (!manifest) {
    return NextResponse.json(
      { error: "Sync agent bundle is not available", code: "BUNDLE_NOT_BUILT" },
      { status: 503 },
    );
  }

  return NextResponse.json(manifest);
}
