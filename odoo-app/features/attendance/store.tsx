import { AppState } from "react-native";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from "react";
import { useSession } from "@/features/auth/session";
import { ApiError } from "@/features/api";
import { selfieForm } from "./api";
import { todayDate as companyToday, monthStart, type Attendance, type Position } from "./types";
export { ApiError as ClockError } from "@/features/api";
type Attempt = { selfieUri: string; position: Position };
type State = { today: Attendance | null; records: Attendance[]; loading: boolean; refreshing: boolean; error: string | null; todayDate: string };
type ContextValue = State & { checkedIn: boolean; dayComplete: boolean; refresh: () => Promise<void>; checkIn: (attempt: Attempt) => Promise<Attendance>; checkOut: (attempt: Attempt) => Promise<Attendance> };
const Context = createContext<ContextValue | null>(null);
const empty = (): State => ({ today: null, records: [], loading: true, refreshing: false, error: null, todayDate: companyToday() });
export function AttendanceProvider({ children }: PropsWithChildren) {
  const { user, request } = useSession();
  const [state, setState] = useState(empty);
  const version = useRef(0);
  const clocking = useRef(false);
  const refresh = useCallback(async () => {
    const current = ++version.current;
    if (!user) { setState({ ...empty(), loading: false }); return; }
    setState(s => ({ ...s, refreshing: true, error: null }));
    try {
      const date = companyToday();
      // Include the current week even when it begins in the previous month.
      const weekStart = new Date(date + "T12:00:00Z");
      weekStart.setUTCDate(weekStart.getUTCDate() - (weekStart.getUTCDay() + 6) % 7);
      const from = [monthStart(date), weekStart.toISOString().slice(0, 10)].sort()[0];
      const today = await request<Attendance | null>("/attendance/me/today");
      const records: Attendance[] = [];
      let offset = 0;
      while (true) {
        const result = await request<{ attendances: Attendance[]; pagination: { hasMore: boolean } }>(`/attendance/me?from=${from}&to=${date}&limit=100&offset=${offset}`);
        records.push(...result.attendances);
        if (!result.pagination.hasMore || !result.attendances.length) break;
        offset += result.attendances.length;
      }
      if (current === version.current) setState({ today, records: records.sort((a, b) => b.attendanceDate.localeCompare(a.attendanceDate)), todayDate: date, error: null, loading: false, refreshing: false });
    } catch (error) {
      if (current === version.current) setState(s => ({ ...s, error: error instanceof Error ? error.message : "Attendance could not be loaded.", loading: false, refreshing: false }));
    }
  }, [user, request]);
  useEffect(() => {
    setState(empty());
    void refresh();
    const subscription = AppState.addEventListener("change", status => { if (status === "active") void refresh(); });
    return () => { version.current++; subscription.remove(); };
  }, [refresh]);
  async function clock(action: string, attempt: Attempt) {
    if (clocking.current) throw new ApiError("Attendance is already being saved.", 409);
    clocking.current = true;
    const epoch = version.current;
    try {
      const body = await selfieForm(attempt.selfieUri, attempt.position);
      const saved = await request<Attendance>(`/attendance/${action}`, { method: "POST", body });
      if (epoch === version.current) setState(s => ({ ...s, today: saved }));
      await refresh(); // refresh failures are shown separately from the successful write.
      return saved;
    } finally { clocking.current = false; }
  }
  return <Context.Provider value={{ ...state, checkedIn: !!state.today?.checkIn && !state.today.checkOut, dayComplete: !!state.today?.checkOut, refresh, checkIn: attempt => clock("check-in", attempt), checkOut: attempt => clock("check-out", attempt) }}>{children}</Context.Provider>;
}
export function useAttendance() {
  const value = useContext(Context);
  if (!value) throw new Error("AttendanceProvider is missing");
  return value;
}
