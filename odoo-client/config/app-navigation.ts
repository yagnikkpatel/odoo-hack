import type { ComponentType } from "react";
import {
  IconCalendarTime,
  IconClockHour4,
  IconFileText,
  IconLayoutKanban,
  IconReportAnalytics,
  IconSettings,
  IconUsersGroup,
  IconWallet,
} from "@tabler/icons-react";

type NavigationIcon = ComponentType<{ className?: string; stroke?: number }>;

export type NavigationDestination = {
  id: string;
  label: string;
  href: string;
  status: "ready" | "planned";
  aliases?: readonly string[];
};

export type NavigationItem = {
  icon: NavigationIcon;
  iconClassName: string;
} & (
  | NavigationDestination
  | { id: string; label: string; children: readonly NavigationDestination[] }
);

export type NavigationGroup = {
  id: "main" | "secondary";
  label: string;
  items: readonly NavigationItem[];
};

// All roles share this navigation during the UI phase; this is not authorization.
export const appNavigation: readonly NavigationGroup[] = [
  {
    id: "main",
    label: "Workspace",
    items: [
      {
        id: "employees",
        label: "Employees",
        href: "/employees",
        icon: IconUsersGroup,
        iconClassName: "text-blue-600",
        status: "ready",
      },
      {
        id: "contracts",
        label: "Contracts",
        href: "/contracts",
        icon: IconFileText,
        iconClassName: "text-violet-600",
        status: "planned",
      },
      {
        id: "attendance",
        label: "Attendance",
        icon: IconClockHour4,
        iconClassName: "text-emerald-600",
        children: [
          {
            id: "attendance-records",
            label: "Attendance records",
            href: "/attendance",
            status: "planned",
          },
          {
            id: "working-schedules",
            label: "Working schedules",
            href: "/attendance/schedules",
            status: "planned",
          },
        ],
      },
      {
        id: "time-off",
        label: "Time off",
        icon: IconCalendarTime,
        iconClassName: "text-amber-600",
        children: [
          {
            id: "time-off-requests",
            label: "Requests",
            href: "/time-off/requests",
            status: "planned",
          },
          {
            id: "time-off-allocations",
            label: "Allocations",
            href: "/time-off/allocations",
            status: "planned",
          },
          {
            id: "time-off-types",
            label: "Time off types",
            href: "/time-off/types",
            status: "planned",
          },
        ],
      },
      {
        id: "payroll",
        label: "Payroll",
        icon: IconWallet,
        iconClassName: "text-rose-600",
        children: [
          {
            id: "payruns",
            label: "Payruns",
            href: "/payroll",
            status: "planned",
          },
          {
            id: "payslips",
            label: "Payslips",
            href: "/payslips",
            status: "planned",
          },
          {
            id: "salary-structures",
            label: "Salary structures",
            href: "/payroll/structures",
            status: "planned",
          },
          {
            id: "salary-rules",
            label: "Salary rules",
            href: "/payroll/rules",
            status: "planned",
          },
        ],
      },
      {
        id: "reports",
        label: "Reports",
        icon: IconReportAnalytics,
        iconClassName: "text-teal-600",
        children: [
          {
            id: "dashboard",
            label: "Dashboard",
            href: "/dashboards/analytics",
            aliases: ["/dashboard"],
            status: "ready",
          },
          {
            id: "hr-payroll-reports",
            label: "HR & payroll reports",
            href: "/reports",
            status: "planned",
          },
        ],
      },
    ],
  },
  {
    id: "secondary",
    label: "Tools & administration",
    items: [
      {
        id: "kanban",
        label: "Kanban",
        href: "/kanban",
        aliases: ["/opportunities"],
        icon: IconLayoutKanban,
        iconClassName: "text-indigo-600",
        status: "ready",
      },
      {
        id: "settings",
        label: "Settings",
        icon: IconSettings,
        iconClassName: "text-sky-600",
        children: [
          {
            id: "users-roles",
            label: "Users & roles",
            href: "/settings/users",
            status: "planned",
          },
          {
            id: "system-settings",
            label: "System settings",
            href: "/settings",
            status: "planned",
          },
        ],
      },
    ],
  },
];

export const navigationDestinations = appNavigation.flatMap((group) =>
  group.items.flatMap((item) =>
    "children" in item ? [...item.children] : [item],
  ),
);

export function getActiveNavigationDestination(pathname: string) {
  // Longest matching path wins: /payroll/rules must not activate Payruns too.
  let match: NavigationDestination | undefined;
  let matchLength = -1;
  for (const destination of navigationDestinations) {
    for (const href of [destination.href, ...(destination.aliases ?? [])]) {
      if (
        (pathname === href || pathname.startsWith(href + "/")) &&
        href.length > matchLength
      ) {
        match = destination;
        matchLength = href.length;
      }
    }
  }
  return match;
}

export function isNavigationItemActive(item: NavigationItem, pathname: string) {
  const active = getActiveNavigationDestination(pathname);
  return "children" in item
    ? item.children.some((child) => child.id === active?.id)
    : item.id === active?.id;
}
