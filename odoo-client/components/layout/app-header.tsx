"use client";

import { IconMenu2 } from "@tabler/icons-react";
import { PanelLeftIcon } from "lucide-react";

import { Button } from "@/features/nexacrm/components/ui/button";
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
        <PanelLeftIcon
          className={`size-5 transition-transform ${collapsed ? "rotate-180" : ""}`}
          strokeWidth={1.8}
        />
        <span className="sr-only">
          {collapsed ? "Expand navigation" : "Collapse navigation"}
        </span>
      </Button>

      <div className="bg-border mx-2 h-5 w-px" />
      <p className="truncate text-sm font-medium">{pageLabel}</p>
    </header>
  );
}
