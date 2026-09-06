import Constants from "expo-constants";
import { Platform } from "react-native";
import { normalizeBackendUrl } from "@/config/backend.cjs";

export class ApiError extends Error {
  constructor(message: string, public status: number, public code: string | null = null) { super(message); }
}

export function apiBaseUrl() {
  const configured = Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return normalizeBackendUrl(configured, { production: !__DEV__ });
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  if (__DEV__ && host) return `http://${host}:4000/api`;
  if (__DEV__ && Platform.OS === "web" && typeof window !== "undefined") return `http://${window.location.hostname}:4000/api`;
  throw new ApiError("Backend is not configured. Run npm run connect before building the app.", 0);
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(apiBaseUrl() + path, { ...init, headers, signal: init.signal ?? controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const missingVerification = response.status === 404 && /verification|\/face$/.test(path);
      throw new ApiError(missingVerification
        ? "This server does not support face check-in yet. Ask HR to enable the attendance verification endpoints."
        : payload?.message || `Request failed (${response.status}).`, response.status, payload?.code ?? null);
    }
    if (payload?.success !== true) throw new ApiError("The server returned an invalid response.", 502);
    return payload.data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(`Couldn’t reach the server (${error instanceof Error ? error.message : "connection failed"}). Check the API address and Wi-Fi connection.`, 0);
  } finally { clearTimeout(timeout); }
}
