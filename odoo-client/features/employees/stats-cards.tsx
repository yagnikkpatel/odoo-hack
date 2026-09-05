'use client'

import { Building2Icon, UserRoundCheckIcon, UsersIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import { Skeleton } from '@/features/nexacrm/components/ui/skeleton'
import { formatNumber } from '@/features/nexacrm/utils/format'
import { useEmployeesStore } from './store'
import { employeeStats } from './stats'

export default function EmployeesStatsCards() {
  const summary = useEmployeesStore((state) => state.summary)
  const hasHydrated = useEmployeesStore((state) => state.hasHydrated)
  const { total, departments, active } = employeeStats(summary)
  const stats: { label: string; value: number; icon: LucideIcon }[] = [
    { label: 'Total employees', value: total, icon: UsersIcon },
    { label: 'Departments', value: departments, icon: Building2Icon },
    { label: 'Active employees', value: active, icon: UserRoundCheckIcon },
  ]

  return (
    <div
      aria-label="Employee directory totals"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-6 xl:grid-cols-3"
    >
      {stats.map(({ label, value, icon: Icon }) => {
        let content = <Skeleton className="h-7 w-20" />
        if (hasHydrated) {
          content = (
            <p className="truncate text-2xl font-semibold tabular-nums">
              {formatNumber(value)}
            </p>
          )
        }
        return (
          <Card key={label}>
            <CardContent className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <p className="text-muted-foreground truncate text-sm">{label}</p>
                {content}
              </div>
              <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-5" />
              </span>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
