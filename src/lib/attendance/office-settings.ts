import { db } from "@/db";
import { officeSettings } from "@/db/schema";
import { BUSINESS_TIMEZONE } from "./constants";
import type { OfficeGeofence } from "./geofence";
import type { OfficeGeofenceResult } from "./office-env";
import { parseOfficeGeofenceFromEnv } from "./office-env";

export type { OfficeGeofenceResult };

/**
 * Office geofence from `office_settings` (single row). Seeds from env on first use when empty.
 */
export async function getOfficeGeofence(): Promise<OfficeGeofenceResult> {
  const [row] = await db.select().from(officeSettings).limit(1);

  if (row) {
    return {
      ok: true,
      office: {
        lat: row.lat,
        lng: row.lng,
        radiusMeters: row.radiusMeters,
      },
    };
  }

  const envResult = parseOfficeGeofenceFromEnv();
  if (!envResult.ok) {
    return envResult;
  }

  await db.insert(officeSettings).values({
    lat: envResult.office.lat,
    lng: envResult.office.lng,
    radiusMeters: envResult.office.radiusMeters,
    timezone: BUSINESS_TIMEZONE,
  });

  return envResult;
}

export function officeGeofenceFromRow(row: {
  lat: number;
  lng: number;
  radiusMeters: number;
}): OfficeGeofence {
  return {
    lat: row.lat,
    lng: row.lng,
    radiusMeters: row.radiusMeters,
  };
}
