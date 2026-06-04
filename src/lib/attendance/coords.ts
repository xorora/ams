export type Coordinates = { lat: number; lng: number };

export function parseCoordinates(
  body: unknown,
): { ok: true; coords: Coordinates } | { ok: false; code: string; message: string } {
  if (body == null || typeof body !== "object") {
    return {
      ok: false,
      code: "INVALID_BODY",
      message: "Request body must include lat and lng.",
    };
  }

  const { lat, lng } = body as { lat?: unknown; lng?: unknown };
  const parsedLat = typeof lat === "number" ? lat : Number.parseFloat(String(lat ?? ""));
  const parsedLng = typeof lng === "number" ? lng : Number.parseFloat(String(lng ?? ""));

  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
    return {
      ok: false,
      code: "INVALID_COORDINATES",
      message: "Valid latitude and longitude are required.",
    };
  }

  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return {
      ok: false,
      code: "INVALID_COORDINATES",
      message: "Latitude must be between -90 and 90; longitude between -180 and 180.",
    };
  }

  return { ok: true, coords: { lat: parsedLat, lng: parsedLng } };
}
