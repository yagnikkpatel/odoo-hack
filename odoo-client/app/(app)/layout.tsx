import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { authConfig } from "@/features/auth/auth-config";
import { verifySession } from "@/features/auth/session";
import DemoRecordsProvider from "@/features/nexacrm/providers/demo-records-provider";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const user = authConfig.previewEnabled
    ? authConfig.previewUser
    : await verifySession();

  return (
    <DemoRecordsProvider>
      <AppShell user={user}>{children}</AppShell>
    </DemoRecordsProvider>
  );
}
