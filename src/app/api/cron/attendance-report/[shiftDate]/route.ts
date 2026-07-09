import { NextResponse } from "next/server";
import { getAttendanceSnapshot } from "@/lib/admin/attendance-snapshot";
import {
  cronNotConfiguredResponse,
  cronUnauthorizedResponse,
  getCronSecret,
  verifyCronAuth,
} from "@/lib/cron/auth";

type RouteContext = {
  params: Promise<{ shiftDate: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  if (!getCronSecret()) {
    return cronNotConfiguredResponse();
  }

  if (!verifyCronAuth(request)) {
    return cronUnauthorizedResponse();
  }

  const { shiftDate } = await context.params;
  const company = new URL(request.url).searchParams.get("company") ?? "xorora";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(shiftDate)) {
    return NextResponse.json(
      { error: "shiftDate must be YYYY-MM-DD", code: "INVALID_SHIFT_DATE" },
      { status: 400 },
    );
  }

  try {
    const snapshot = await getAttendanceSnapshot(shiftDate, company);
    console.info("[cron/attendance-report]", JSON.stringify({
      shiftDate: snapshot.shiftDate,
      activeEmployees: snapshot.activeEmployees,
      withCheckIn: snapshot.withCheckIn,
      withoutCheckIn: snapshot.withoutCheckIn,
      employees: snapshot.employees,
    }));
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error("[cron/attendance-report]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load attendance snapshot",
        code: "SNAPSHOT_FAILED",
      },
      { status: 500 },
    );
  }
}
