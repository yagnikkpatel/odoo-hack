"use client";

import {
  Building2Icon,
  UserCheckIcon,
  UserXIcon,
  UsersIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/features/nexacrm/components/ui/card";
import { Skeleton } from "@/features/nexacrm/components/ui/skeleton";
import { formatNumber } from "@/features/nexacrm/utils/format";
import { useEmployeesStore } from "./store";
import { employeeStats } from "./stats";

export default function EmployeesStatsCards() {
  const employees = useEmployeesStore((state) => state.employees);
  const hasHydrated = useEmployeesStore((state) => state.hasHydrated);
  const { total, departments, withManager, withoutManager } =
    employeeStats(employees);

  const stats: { label: string; value: string; icon: LucideIcon }[] = [
    { label: "Total employees", value: formatNumber(total), icon: UsersIcon },
    {
      label: "Departments",
      value: formatNumber(departments),
      icon: Building2Icon,
    },
    {
      label: "With manager",
      value: formatNumber(withManager),
      icon: UserCheckIcon,
    },
    {
      label: "Without manager",
      value: formatNumber(withoutManager),
      icon: UserXIcon,
    },
  ];

  // Preserve the NexaCRM People KPI markup; only the employee data and labels differ.
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-6 xl:grid-cols-4">
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-2">
              <p className="text-muted-foreground truncate text-sm">{label}</p>
              {hasHydrated ? (
                <p className="truncate text-2xl font-semibold tabular-nums">
                  {value}
                </p>
              ) : (
                <Skeleton className="h-7 w-20" />
              )}
            </div>
            <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-5" />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
