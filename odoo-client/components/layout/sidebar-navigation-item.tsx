"use client";

import Link from "next/link";
import { IconChevronRight } from "@tabler/icons-react";

import {
  getActiveNavigationDestination,
  isNavigationItemActive,
  type NavigationDestination,
  type NavigationItem,
} from "@/config/app-navigation";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/features/nexacrm/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/features/nexacrm/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SidebarNavigationItemProps = {
  item: NavigationItem;
  pathname: string;
  collapsed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
};

const rowClassName =
  "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-ring flex h-9 w-full items-center gap-3 rounded-md px-2 text-sm outline-none transition-colors focus-visible:ring-2 motion-reduce:transition-none";
const activeClassName =
  "bg-sidebar-accent text-sidebar-accent-foreground font-medium";

function SoonLabel() {
  return (
    <span className="text-muted-foreground/70 ml-auto text-[10px] font-normal">
      Soon
    </span>
  );
}

function SubmenuLink({
  destination,
  active,
  onNavigate,
}: {
  destination: NavigationDestination;
  active: boolean;
  onNavigate: () => void;
}) {
  const className = cn(
    rowClassName,
    "h-8 gap-2 text-[13px]",
    active && activeClassName,
  );
  if (destination.status === "planned") {
    return (
      <span
        aria-disabled="true"
        title="This page has not been built yet"
        className={cn(
          className,
          "cursor-default hover:bg-transparent hover:text-muted-foreground",
        )}
      >
        <span className="truncate">{destination.label}</span>
        <SoonLabel />
      </span>
    );
  }
  return (
    <Link
      href={destination.href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={className}
    >
      <span className="truncate">{destination.label}</span>
    </Link>
  );
}

export function SidebarNavigationItem({
  item,
  pathname,
  collapsed,
  open,
  onOpenChange,
  onNavigate,
}: SidebarNavigationItemProps) {
  const Icon = item.icon;
  const active = isNavigationItemActive(item, pathname);
  const activeId = getActiveNavigationDestination(pathname)?.id;
  const icon = (
    <Icon
      className={cn("size-[1.125rem] shrink-0", item.iconClassName)}
      stroke={1.8}
    />
  );
  const className = cn(
    rowClassName,
    active && activeClassName,
    collapsed && "md:justify-center",
  );

  if (!("children" in item)) {
    const content = (
      <>
        {icon}
        <span className={cn("truncate", collapsed && "md:hidden")}>
          {item.label}
        </span>
      </>
    );
    return item.status === "ready" ? (
      <Link
        href={item.href}
        prefetch={false}
        title={collapsed ? item.label : undefined}
        aria-label={item.label}
        aria-current={active ? "page" : undefined}
        onClick={onNavigate}
        className={className}
      >
        {content}
      </Link>
    ) : (
      <span
        aria-disabled="true"
        aria-label={`${item.label} — coming soon`}
        title={`${item.label} — coming soon`}
        className={cn(
          className,
          "cursor-default hover:bg-transparent hover:text-muted-foreground",
        )}
      >
        {content}
        <span className={cn("ml-auto", collapsed && "md:hidden")}>
          <SoonLabel />
        </span>
      </span>
    );
  }

  if (item.children.every((child) => child.status === "planned")) {
    return (
      <span
        aria-disabled="true"
        aria-label={`${item.label} — temporarily unavailable`}
        title={`${item.label} — temporarily unavailable`}
        className={cn(
          className,
          "text-sidebar-foreground cursor-default hover:bg-transparent hover:text-sidebar-foreground",
        )}
      >
        {icon}
        <span className={cn("truncate", collapsed && "md:hidden")}>
          {item.label}
        </span>
      </span>
    );
  }

  return (
    <>
      {/* The expanded sidebar and mobile drawer use the template disclosure. */}
      <Collapsible
        open={open}
        onOpenChange={onOpenChange}
        className={cn(collapsed && "md:hidden")}
      >
        <CollapsibleTrigger
          className={cn(rowClassName, active && activeClassName)}
        >
          {icon}
          <span className="truncate">{item.label}</span>
          <IconChevronRight
            className={cn(
              "ml-auto size-3.5 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-90",
            )}
            stroke={1.8}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
          <ul className="border-sidebar-border my-1 ml-4 space-y-0.5 border-l pl-3">
            {item.children.map((child) => (
              <li key={child.id}>
                <SubmenuLink
                  destination={child}
                  active={child.id === activeId}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>

      {/* Every submenu stays reachable when the desktop sidebar is icon-only. */}
      {collapsed && (
        <div className="hidden md:block">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={className}
              aria-label={item.label}
              title={item.label}
            >
              {icon}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="start"
              sideOffset={12}
              className="w-56"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
                {item.children.map((child) =>
                  child.status === "planned" ? (
                    <DropdownMenuItem
                      key={child.id}
                      disabled
                      className="min-h-8 gap-3"
                    >
                      {child.label}
                      <SoonLabel />
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem
                      key={child.id}
                      render={<Link href={child.href} prefetch={false} />}
                      nativeButton={false}
                      onClick={onNavigate}
                      aria-current={child.id === activeId ? "page" : undefined}
                      className={cn(
                        "min-h-8",
                        child.id === activeId && activeClassName,
                      )}
                    >
                      {child.label}
                    </DropdownMenuItem>
                  ),
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </>
  );
}
