export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertAuthEnv } = await import("@/lib/env");
    const { parseOfficeGeofenceFromEnv } = await import("@/lib/attendance/office-env");

    assertAuthEnv();
    const office = parseOfficeGeofenceFromEnv();
    if (!office.ok) {
      throw new Error(office.error);
    }
  }
}
