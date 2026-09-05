import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useSession } from "@/features/auth/session";
import type { VerificationStatus } from "./types";
type State = { status: "loading"; data?: never; error?: never } | { status: "ready"; data: VerificationStatus; error?: never } | { status: "error"; data?: never; error: string };
export function useVerificationStatus() {
  const { request, user } = useSession();
  const [state, setState] = useState<State>({ status: "loading" });
  const revision = useRef(0);
  const reload = useCallback(async () => {
    const current = ++revision.current;
    setState({ status: "loading" });
    try {
      const data = await request<VerificationStatus>("/attendance/me/verification");
      if (!data?.face || !data?.office) throw new Error("Invalid verification response.");
      if (current === revision.current) setState({ status: "ready", data });
    } catch (error) { if (current === revision.current) setState({ status: "error", error: error instanceof Error ? error.message : "Could not load verification." }); }
  }, [request]);
  useEffect(() => () => { revision.current++; }, [user?.id]);
  useFocusEffect(useCallback(() => { void reload(); return () => { revision.current++; }; }, [reload]));
  return { ...state, reload };
}
