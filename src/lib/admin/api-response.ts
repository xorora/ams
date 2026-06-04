import { NextResponse } from "next/server";
import type { ServiceFailure } from "./types";

export function adminErrorResponse(error: ServiceFailure) {
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
}

export function parseJsonError() {
  return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, { status: 400 });
}
