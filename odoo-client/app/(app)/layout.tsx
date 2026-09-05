import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import {
  AuthServiceUnavailableError,
  verifySession,
} from "@/features/auth/session";
import AppRecordsProvider from "@/features/nexacrm/providers/app-records-provider";
import { SessionGuard } from "@/features/auth/components/session-guard";
import { SessionUnavailable } from "@/features/auth/components/session-unavailable";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  let user;
  try {
    user = await verifySession();
  } catch (error) {
    if (error instanceof AuthServiceUnavailableError)
      return <SessionUnavailable />;
    throw error;
  }

  return (
    <AppRecordsProvider key={user.id} user={user}>
      <SessionGuard user={user}>
        <AppShell user={user}>{children}</AppShell>
      </SessionGuard>
    </AppRecordsProvider>
  );
}
