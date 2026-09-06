"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { canAccessNavigationRoute, getNavigationForUser } from "@/config/app-navigation";
import { Button } from "@/features/nexacrm/components/ui/button";

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
    permissions?: readonly string[];
  };
};

export function AppShell({ children, user }: AppShellProps) {
  const pathname = usePathname();
  const canAccessPage = canAccessNavigationRoute(pathname, user);
  const firstItem = getNavigationForUser(user)[0]?.items[0];
  const homeHref = firstItem && ("children" in firstItem ? firstItem.children[0]?.href : firstItem.href);
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
        <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden md:rounded-tl-3xl md:border">
          <AppHeader
            user={user}
            collapsed={collapsed}
            onDesktopToggle={() => setCollapsed((current) => !current)}
            onMobileOpen={() => setMobileOpen(true)}
          />
          <ScrollArea className="bg-background min-h-0 flex-1">
            <main className="grid h-full w-full auto-rows-min grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] px-4 pb-4">
              {canAccessPage ? children : (
                <div className="flex min-h-72 flex-col items-center justify-center gap-3 py-12 text-center">
                  <h1 className="text-lg font-semibold">This page is unavailable for your role</h1>
                  <p className="text-muted-foreground text-sm">Choose an available page from your workspace.</p>
                  {homeHref && (
                    <Button variant="outline" render={<Link href={homeHref} />}>Go to my workspace</Button>
                  )}
                </div>
              )}
            </main>
          </ScrollArea>
        </div>
        <Toaster />
      </div>
    </TooltipProvider>
  );
}
