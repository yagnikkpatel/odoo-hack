import { AppError } from "../errors/AppError";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/** Great-circle distance in metres. Coordinates must be GPS degrees, not radians. */
export function distanceBetween(a: Coordinates, b: Coordinates): number {
  for (const point of [a, b]) {
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude) ||
        Math.abs(point.latitude) > 90 || Math.abs(point.longitude) > 180) {
      throw new AppError(400, "Location must contain valid latitude and longitude");
    }
  }
  const radians = Math.PI / 180;
  const latitudeDelta = (b.latitude - a.latitude) * radians;
  const longitudeDelta = (b.longitude - a.longitude) * radians;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) *
    Math.sin(longitudeDelta / 2) ** 2;
  // Clamp floating-point drift near antipodes before the square root.
  return 6_371_008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, haversine))));
}

export function formatDistance(metres: number): string {
  return metres < 1_000 ? `${Math.round(metres)} m` : `${(metres / 1_000).toFixed(1)} km`;
}
