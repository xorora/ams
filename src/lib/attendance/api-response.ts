import { NextResponse } from "next/server";
import type { ServiceFailure } from "./service";

export function serviceErrorResponse(error: ServiceFailure) {
  return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
}

export function parseJsonError() {
  return NextResponse.json({ error: "Invalid JSON body", code: "INVALID_JSON" }, { status: 400 });
}
