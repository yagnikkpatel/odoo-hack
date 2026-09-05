'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ExternalLinkIcon } from 'lucide-react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { opportunityDisplayName } from '@/features/nexacrm/types/apps/opportunity-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import CompanyAvatar from '@/features/nexacrm/components/record/company-avatar'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import { RecordInitial } from '@/features/nexacrm/components/record/record-icon'

// Store Imports
import { useCompany } from '@/features/nexacrm/store/use-companies-store'
import { usePerson } from '@/features/nexacrm/store/use-people-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

export const OpportunityNameCell = ({ opportunity }: { opportunity: Opportunity }) => {
  const label = opportunityDisplayName(opportunity)
  const untitled = !opportunity.name.trim()

  return (
    <div className='flex min-w-0 items-center gap-2'>
      <RecordInitial label={untitled ? '' : label} seed={opportunity.id} className='size-5!' />
      <span className={cn('min-w-0 truncate font-medium', untitled && 'text-muted-foreground font-normal')}>
        {label}
      </span>

      <ExternalLinkIcon className='text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100' />
    </div>
  )
}

export const OpportunityCompanyCell = ({ companyId }: { companyId?: string }) => {
  const company = useCompany(companyId)

  if (!company) return <span className='text-muted-foreground'>-</span>

  return (
    <Link
      href={`/companies/${company.id}`}
      onClick={event => event.stopPropagation()}
      className='flex min-w-0 items-center gap-2 hover:underline'
    >
      <CompanyAvatar company={company} className='size-5!' fallbackClassName='text-[10px]' />
      <span className='truncate'>{company.name.trim() || 'Untitled'}</span>
    </Link>
  )
}

/** The person being sold to - the point of contact, resolved from the people store. */
export const OpportunityPointOfContactCell = ({ personId }: { personId?: string }) => {
  const person = usePerson(personId)

  if (!person) return <span className='text-muted-foreground'>-</span>

  const label = personDisplayName(person)

  return (
    <Link
      href={`/employees/${person.id}`}
      onClick={event => event.stopPropagation()}
      className='flex min-w-0 items-center gap-2 hover:underline'
    >
      <PersonAvatar name={label} src={person.avatar} className='size-5!' fallbackClassName='text-[10px]' />
      <span className='truncate'>{label}</span>
    </Link>
  )
}
