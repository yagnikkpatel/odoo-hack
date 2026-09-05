"use client";

import { useState, type ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ScrollArea } from "@/features/nexacrm/components/ui/scroll-area";
import { Toaster } from "@/features/nexacrm/components/ui/sonner";
import { TooltipProvider } from "@/features/nexacrm/components/ui/tooltip";

type AppShellProps = {
  children: ReactNode;
  user: {
    email: string;
    role: string;
  };
};

export function AppShell({ children, user }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TooltipProvider>
      <div className="bg-sidebar flex h-svh w-full overflow-hidden">
        <AppSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
          user={user}
        />
        <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:border xl:rounded-tl-3xl">
          <AppHeader
            role={user.role}
            collapsed={collapsed}
            onDesktopToggle={() => setCollapsed((current) => !current)}
            onMobileOpen={() => setMobileOpen(true)}
          />
          <ScrollArea className="bg-background min-h-0 flex-1">
            <main className="grid h-full w-full auto-rows-min grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] px-4 pb-4">
              {children}
            </main>
          </ScrollArea>
        </div>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
