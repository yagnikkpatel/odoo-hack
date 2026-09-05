import { useCallback, useState, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { useSession } from "@/features/auth/session";
import { ApiError } from "@/features/api";
type Profile = { name: string; jobPosition: string; department: string; managerName: string | null; workingSchedule: string; workLocation: string; company: string; contact: string; imageUrl?: string; employeeImage?: { imageUrl: string } };
export function useEmployeeProfile() {
  const { user, request } = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);
  const reload = useCallback(async () => {
    const ticket = ++version.current;
    if (!user) { setProfile(null); return; }
    setStatus("loading");
    try {
      const value = await request<Profile>(`/employees/${user.id}`);
      if (ticket !== version.current) return;
      setProfile({ ...value, imageUrl: value.employeeImage?.imageUrl }); setStatus("ready"); setError(null);
    } catch (cause) {
      if (ticket !== version.current) return;
      setProfile(null); setStatus(cause instanceof ApiError && cause.status === 404 ? "missing" : "error");
      setError(cause instanceof Error ? cause.message : "Could not load your profile.");
    }
  }, [user, request]);
  useFocusEffect(useCallback(() => { void reload(); return () => { version.current++; }; }, [reload]));
  return { profile, status, error, reload };
}
