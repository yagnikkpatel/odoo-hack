import type { ComponentType } from "react";
import { moduleAccess, type Actor } from "@/features/auth/permissions";
import {
  IconCalendarTime,
  IconClockHour4,
  IconFileText,
  IconReportAnalytics,
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
  id: "main";
  label: string;
  items: readonly NavigationItem[];
};

// Management navigation. API permissions remain the authorization boundary.
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
        status: "ready",
      },
      {
        id: "attendance",
        label: "Attendance",
        href: "/attendance",
        icon: IconClockHour4,
        iconClassName: "text-emerald-600",
        status: "ready",
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
            status: "ready",
          },
          {
            id: "time-off-allocations",
            label: "Allocations",
            href: "/time-off/allocations",
            status: "ready",
          },
          {
            id: "time-off-types",
            label: "Time off types",
            href: "/time-off/types",
            status: "ready",
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
            status: "ready",
          },
          {
            id: "payslips",
            label: "Payslips",
            href: "/payslips",
            status: "ready",
          },
          {
            id: "salary-structures",
            label: "Salary structures",
            href: "/payroll/structures",
            status: "ready",
          },
          {
            id: "salary-rules",
            label: "Salary rules",
            href: "/payroll/rules",
            status: "ready",
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
            status: "ready",
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

const employeeNavigation: readonly NavigationGroup[] = [
  {
    id: "main",
    label: "My workspace",
    items: [
      {
        id: "attendance",
        label: "My Attendance",
        href: "/attendance",
        icon: IconClockHour4,
        iconClassName: "text-emerald-600",
        status: "ready",
      },
      {
        id: "time-off-requests",
        label: "Time off",
        href: "/time-off/requests",
        icon: IconCalendarTime,
        iconClassName: "text-amber-600",
        status: "ready",
      },
      {
        id: "employees",
        label: "My Profile",
        href: "/employees",
        icon: IconUsersGroup,
        iconClassName: "text-blue-600",
        status: "ready",
      },
    ],
  },
];

/** Match each destination to the API capability needed to load its page. */
export function getNavigationForUser(user: Actor): readonly NavigationGroup[] {
  const access = moduleAccess(user);
  const visible: Record<string, boolean> = {
    employees: access.employees.canRead,
    attendance: access.attendance.canReadOwn,
    contracts: access.contracts.canRead,
    "time-off-requests": access.timeOff.canReadOwn,
    "time-off-allocations": access.timeOff.canReadAllocations,
    "time-off-types": access.timeOff.canReadTypes,
    payruns: access.payroll.canReadPayruns,
    payslips: access.payroll.canReadPayslips,
    "salary-structures": access.payroll.canReadStructures,
    "salary-rules": access.payroll.canReadRules,
    dashboard: access.payroll.canReport,
    "hr-payroll-reports": access.payroll.canReport,
  };
  const navigation = user.role === "employee" ? employeeNavigation : appNavigation;
  return navigation.map(group => ({
    ...group,
    items: group.items.flatMap((item): NavigationItem[] => {
      if (!("children" in item)) return visible[item.id] ? [item] : [];
      const children = item.children.filter(child => visible[child.id]);
      return children.length ? [{ ...item, children }] : [];
    }),
  })).filter(group => group.items.length > 0);
}

export function getNavigationForRole(role: string): readonly NavigationGroup[] {
  return getNavigationForUser({ role });
}

export function getNavigationLabel(pathname: string, user: Actor | string) {
  const active = getActiveNavigationDestination(pathname);
  const destinations = getNavigationForUser(typeof user === "string" ? { role: user } : user)
    .flatMap(group => group.items.flatMap(item => "children" in item ? [...item.children] : [item]));
  return destinations.find(item => item.id === active?.id)?.label;
}

/** UI guard only; backend permissions still authorize every data request. */
export function canAccessNavigationRoute(pathname: string, user: Actor) {
  // The original CRM demo pages have no HR permissions or navigation entry.
  if (["/kanban", "/opportunities"].some(href => pathname === href || pathname.startsWith(href + "/"))) {
    return false;
  }
  const active = getActiveNavigationDestination(pathname);
  if (!active) return true;
  if (active.id === "attendance" && pathname !== "/attendance" && pathname !== "/attendance/") {
    return moduleAccess(user).attendance.canReadAny;
  }
  return getNavigationForUser(user).some(group => group.items.some(item =>
    "children" in item
      ? item.children.some(child => child.id === active.id)
      : item.id === active.id,
  ));
}

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
