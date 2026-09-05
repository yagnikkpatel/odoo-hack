'use client'

// Third-party Imports
import { Building2Icon, UserCheckIcon, UserXIcon, UsersIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Component Imports
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import { Skeleton } from '@/features/nexacrm/components/ui/skeleton'

// Store Imports
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'

// Util Imports
import { formatNumber } from '@/features/nexacrm/utils/format'
import { DATA_API_CONNECTED } from '@/features/hr/data-availability'

const PeopleStatsCards = () => {
  const people = usePeopleStore(state => state.people)
  const hasHydrated = usePeopleStore(state => state.hasHydrated)

  const companiesRepresented = new Set(people.map(person => person.companyId).filter(Boolean)).size
  const assigned = people.filter(person => person.accountOwnerId).length
  const unassigned = people.length - assigned

  const stats: { label: string; value: string; icon: LucideIcon }[] = [
    { label: 'Total people', value: formatNumber(people.length), icon: UsersIcon },
    { label: 'Companies represented', value: formatNumber(companiesRepresented), icon: Building2Icon },
    { label: 'Assigned', value: formatNumber(assigned), icon: UserCheckIcon },
    { label: 'Unassigned', value: formatNumber(unassigned), icon: UserXIcon }
  ]

  return (
    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-6 xl:grid-cols-4'>
      {stats.map(({ label, value, icon: Icon }) => (
        <Card key={label}>
          <CardContent className='flex items-start justify-between gap-3'>
            <div className='min-w-0 space-y-2'>
              <p className='text-muted-foreground truncate text-sm'>{label}</p>
              {hasHydrated ? (
                <p className='truncate text-2xl font-semibold tabular-nums'>{DATA_API_CONNECTED ? value : '—'}</p>
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

export default PeopleStatsCards
