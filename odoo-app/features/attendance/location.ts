import * as Location from "expo-location";
import type { Position } from "./types";
export async function capturePosition(): Promise<Position> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error("Allow location access in Settings to check office proximity.");
  if (!await Location.hasServicesEnabledAsync()) throw new Error("Turn on Location Services, then retry.");
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Location took too long. Move near a window and retry.")), 20_000); }),
    ]);
    return { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracyM: fix.coords.accuracy };
  } finally { clearTimeout(timeout); }
}
