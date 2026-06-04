import type { OfficeGeofence } from "./geofence";

export type OfficeGeofenceResult =
  | { ok: true; office: OfficeGeofence }
  | { ok: false; error: string };

/** Parse office geofence from environment variables (used to seed DB). */
export function parseOfficeGeofenceFromEnv(): OfficeGeofenceResult {
  const lat = Number.parseFloat(process.env.OFFICE_LAT ?? "");
  const lng = Number.parseFloat(process.env.OFFICE_LNG ?? "");
  const radiusRaw = process.env.OFFICE_RADIUS_METERS ?? "100";
  const radiusMeters = Number.parseInt(radiusRaw, 10);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { ok: false, error: "Office coordinates are not configured (OFFICE_LAT, OFFICE_LNG)." };
  }
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
    return { ok: false, error: "OFFICE_RADIUS_METERS must be a positive integer." };
  }

  return { ok: true, office: { lat, lng, radiusMeters } };
}
