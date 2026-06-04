const EARTH_RADIUS_METERS = 6_371_000;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two WGS-84 coordinates (Haversine).
 */
export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

export type OfficeGeofence = {
  lat: number;
  lng: number;
  radiusMeters: number;
};

export function isWithinOfficeRadius(
  userLat: number,
  userLng: number,
  office: OfficeGeofence,
): boolean {
  const distance = haversineDistanceMeters(userLat, userLng, office.lat, office.lng);
  return distance <= office.radiusMeters;
}
