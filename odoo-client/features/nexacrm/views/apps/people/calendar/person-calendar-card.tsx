'use client'

// React Imports
import type { ComponentProps, ReactNode } from 'react'

// Third-party Imports
import type { LucideIcon } from 'lucide-react'
import { BriefcaseIcon, Building2Icon, MailIcon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import CompanyAvatar from '@/features/nexacrm/components/record/company-avatar'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'

// Store Imports
import { useCompany } from '@/features/nexacrm/store/use-companies-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

type PersonCalendarCardProps = ComponentProps<typeof Card> & {
  person: Person
}

const CardField = ({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children?: ReactNode }) => (
  <span className='flex min-w-0 items-center gap-1.5'>
    <Icon className='text-muted-foreground/70 size-3.5 shrink-0' />
    {children ? (
      <span className='text-foreground/75 flex min-w-0 items-center gap-1.5 truncate text-[0.75rem] leading-[1.35rem]'>
        {children}
      </span>
    ) : (
      <span className='text-muted-foreground/45 truncate text-[0.75rem] leading-[1.35rem]'>{label}</span>
    )}
  </span>
)

const PersonCalendarCard = ({ person, className, ...props }: PersonCalendarCardProps) => {
  const company = useCompany(person.companyId)

  const label = personDisplayName(person)

  return (
    <Card className={cn('gap-0 py-0 shadow-none', className)} {...props}>
      <CardContent className='flex flex-col gap-2 p-2.5'>
        <span className='flex min-w-0 items-center gap-2'>
          <PersonAvatar name={label} src={person.avatar} className='size-5!' fallbackClassName='text-[10px]' />
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-sm font-medium',
              !person.firstName && !person.lastName && 'text-muted-foreground font-normal'
            )}
          >
            {label}
          </span>
        </span>

        <span className='flex flex-col gap-0.5'>
          <CardField icon={Building2Icon} label='Company'>
            {company ? (
              <>
                <CompanyAvatar company={company} className='size-4!' fallbackClassName='text-[9px]' />
                <span className='truncate'>{company.name.trim() || 'Untitled'}</span>
              </>
            ) : null}
          </CardField>

          <CardField icon={BriefcaseIcon} label='Job title'>
            {person.jobTitle ? <span className='truncate'>{person.jobTitle}</span> : null}
          </CardField>

          <CardField icon={MailIcon} label='Email'>
            {person.email ? <span className='truncate'>{person.email}</span> : null}
          </CardField>
        </span>
      </CardContent>
    </Card>
  )
}

export default PersonCalendarCard
