"use client";

import {
  IconBell,
  IconLayoutSidebarLeftCollapse,
  IconMenu2,
  IconSearch,
} from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { getNavigationLabel } from "@/config/app-navigation";
import { usePathname } from "next/navigation";

type AppHeaderProps = {
  role: string;
  collapsed: boolean;
  onDesktopToggle: () => void;
  onMobileOpen: () => void;
};

export function AppHeader({
  role,
  collapsed,
  onDesktopToggle,
  onMobileOpen,
}: AppHeaderProps) {
  const pathname = usePathname();
  const pageLabel =
    getNavigationLabel(pathname, role) ?? "PeoplePay360";
  return (
    <header className="bg-muted/40 flex h-12 shrink-0 items-center border-b px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-ml-2 md:hidden"
        onClick={onMobileOpen}
      >
        <IconMenu2 className="size-5" stroke={1.8} />
        <span className="sr-only">Open navigation</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="-ml-2 hidden md:inline-flex"
        onClick={onDesktopToggle}
      >
        <IconLayoutSidebarLeftCollapse
          className={`size-5 transition-transform ${collapsed ? "rotate-180" : ""}`}
          stroke={1.8}
        />
        <span className="sr-only">
          {collapsed ? "Expand navigation" : "Collapse navigation"}
        </span>
      </Button>

      <div className="bg-border mx-2 h-5 w-px" />
      <p className="truncate text-sm font-medium">{pageLabel}</p>

      <div className="ml-auto flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground hidden gap-2 sm:inline-flex"
        >
          <IconSearch className="size-4" stroke={1.8} />
          <span>Search</span>
          <kbd className="bg-muted rounded border px-1.5 py-0.5 text-[10px]">
            ⌘ K
          </kbd>
        </Button>
        <Button type="button" variant="ghost" size="icon">
          <IconBell className="size-5" stroke={1.8} />
          <span className="sr-only">Notifications</span>
        </Button>
      </div>
    </header>
  );
}
