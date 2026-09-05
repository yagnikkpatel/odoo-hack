'use client'

// Third-party Imports
import { CalendarClockIcon, CircleCheckIcon, TargetIcon, TrendingUpIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Type Imports
import { isOpenOpportunity, isOverdueOpportunity, isWonOpportunity } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import { Skeleton } from '@/features/nexacrm/components/ui/skeleton'

// Store Imports
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'

// Util Imports
import { formatCompactCurrency, formatNumber } from '@/features/nexacrm/utils/format'

const OpportunitiesStatsCards = () => {
  const opportunities = useOpportunitiesStore(state => state.opportunities)
  const hasHydrated = useOpportunitiesStore(state => state.hasHydrated)

  const open = opportunities.filter(isOpenOpportunity)
  const openValue = open.reduce((sum, opportunity) => sum + opportunity.amount, 0)

  const won = opportunities.filter(isWonOpportunity)
  const wonValue = won.reduce((sum, opportunity) => sum + opportunity.amount, 0)

  const overdue = opportunities.filter(isOverdueOpportunity).length

  const stats: { label: string; value: string; icon: LucideIcon }[] = [
    { label: 'Open opportunities', value: formatNumber(open.length), icon: TargetIcon },
    { label: 'Open pipeline', value: formatCompactCurrency(openValue), icon: TrendingUpIcon },
    { label: 'Won value', value: formatCompactCurrency(wonValue), icon: CircleCheckIcon },
    { label: 'Past close date', value: formatNumber(overdue), icon: CalendarClockIcon }
  ]

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-6 xl:grid-cols-4'>
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className='flex items-start justify-between gap-3'>
            <div className='min-w-0 space-y-2'>
              <p className='text-muted-foreground truncate text-sm'>{label}</p>
              {hasHydrated ? (
                <p className='truncate text-2xl font-semibold tabular-nums'>{value}</p>
              ) : (
                <Skeleton className='h-7 w-20' />
              )}
            </div>
            <span className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg'>
              <Icon className='size-5' />
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export default OpportunitiesStatsCards
