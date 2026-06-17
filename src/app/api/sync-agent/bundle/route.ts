import { NextResponse } from "next/server";
import { loadSyncAgentBundle, verifyUpdateToken } from "@/lib/sync-agent/bundle";

export async function GET(request: Request) {
  if (!process.env.EBIO_UPDATE_TOKEN?.trim()) {
    return NextResponse.json(
      { error: "Sync agent updates are not configured", code: "UPDATE_NOT_CONFIGURED" },
      { status: 500 },
    );
  }

  if (!verifyUpdateToken(request)) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }

  const bundle = loadSyncAgentBundle();
  if (!bundle) {
    return NextResponse.json(
      { error: "Sync agent bundle is not available", code: "BUNDLE_NOT_BUILT" },
      { status: 503 },
    );
  }

  return new NextResponse(new Uint8Array(bundle), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(bundle.length),
      "Cache-Control": "no-store",
    },
  });
}
