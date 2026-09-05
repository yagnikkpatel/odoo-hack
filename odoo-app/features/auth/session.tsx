import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { ApiError, apiRequest } from "@/features/api";

type User = { id: string; email: string; role: string; name?: string };
type Session = { user: User; accessToken: string; refreshToken: string };
type Auth = {
  user: User | null;
  status: "loading" | "signedIn" | "signedOut";
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  request: <T>(path: string, init?: RequestInit) => Promise<T>;
};
const Context = createContext<Auth | null>(null);
const KEY = "peoplepay360.session.v1";
async function persist(value: Session | null) {
  if (Platform.OS === "web") return; // Preview sessions stay in memory, never localStorage.
  if (value) await SecureStore.setItemAsync(KEY, JSON.stringify(value));
  else await SecureStore.deleteItemAsync(KEY);
}
function validSession(value: unknown): value is Session {
  const v = value as Session | null;
  return !!v && typeof v.accessToken === "string" && typeof v.refreshToken === "string" && typeof v.user?.id === "string" && typeof v.user?.email === "string";
}
export function SessionProvider({ children }: PropsWithChildren) {
  const [current, setCurrent] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const session = useRef<Session | null>(null);
  const revision = useRef(0);
  const refreshing = useRef<Promise<Session> | null>(null);
  useEffect(() => {
    let alive = true;
    async function restore() {
      try {
        const saved = Platform.OS === "web" ? null : await SecureStore.getItemAsync(KEY);
        const value: unknown = saved ? JSON.parse(saved) : null;
        if (alive && validSession(value)) { session.current = value; setCurrent(value); }
      } catch { /* A corrupt or inaccessible key returns to login. */ }
      finally { if (alive) setLoading(false); }
    }
    void restore();
    return () => { alive = false; };
  }, []);
  const signOut = useCallback(async () => {
    const previous = session.current;
    revision.current++;
    session.current = null;
    setCurrent(null);
    await persist(null);
    if (previous) void apiRequest("/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: previous.refreshToken }) }).catch(() => {});
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    const value = await apiRequest<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) });
    if (!validSession(value)) throw new Error("Invalid sign-in response.");
    await persist(value);
    revision.current++;
    session.current = value;
    setCurrent(value);
  }, []);
  const request = useCallback(async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const start = session.current;
    if (!start) throw new ApiError("Sign in to continue.", 401);
    try { return await apiRequest<T>(path, init, start.accessToken); }
    catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (!session.current) throw new ApiError("Session ended. Sign in again.", 401);
      if (session.current !== start && session.current) return apiRequest<T>(path, init, session.current.accessToken);
      if (!refreshing.current) {
        const version = revision.current;
        const refresh = apiRequest<Session>("/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: start.refreshToken }) }).then(async value => {
          if (!validSession(value) || revision.current !== version) throw new ApiError("Session ended. Sign in again.", 401);
          await persist(value);
          if (revision.current !== version) { await persist(null); throw new ApiError("Session ended.", 401); }
          session.current = value;
          setCurrent(value);
          return value;
        });
        refreshing.current = refresh;
        void refresh.finally(() => { if (refreshing.current === refresh) refreshing.current = null; }).catch(() => {});
      }
      let renewed: Session;
      try { renewed = await refreshing.current; }
      catch (cause) {
        if (cause instanceof ApiError && (cause.status === 401 || cause.status === 403)) await signOut();
        throw cause;
      }
      return apiRequest<T>(path, init, renewed.accessToken);
    }
  }, [signOut]);
  return <Context.Provider value={{ user: current?.user ?? null, status: loading ? "loading" : current ? "signedIn" : "signedOut", signIn, signOut, request }}>{children}</Context.Provider>;
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error("SessionProvider is missing");
  return value;
}
