'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ExternalLinkIcon, MailIcon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { formatPersonName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import CompanyAvatar from '@/features/nexacrm/components/record/company-avatar'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'

// Store Imports
import { useCompany } from '@/features/nexacrm/store/use-companies-store'

export const PersonNameCell = ({ person }: { person: Person }) => {
  const name = formatPersonName(person)

  return (
    <div className='flex items-center gap-2.5'>
      <PersonAvatar name={name} src={person.avatar} />
      <span className='truncate font-medium'>{name}</span>
      <ExternalLinkIcon className='text-muted-foreground ml-auto size-4 shrink-0 opacity-0 transition-opacity group-hover/row:opacity-100' />
    </div>
  )
}

export const EmailCell = ({ email }: { email: string }) => (
  <div className='text-muted-foreground flex items-center gap-1.5'>
    <MailIcon className='size-3.5 shrink-0' />
    <span className='truncate'>{email}</span>
  </div>
)

export const CompanyRefCell = ({ companyId }: { companyId?: string }) => {
  const company = useCompany(companyId)

  if (!company) return <span className='text-muted-foreground'>-</span>

  return (
    <Link href={`/companies/${company.id}`} className='flex min-w-0 items-center gap-2 hover:underline'>
      <CompanyAvatar company={company} fallbackClassName='text-[10px]' />
      <span className='truncate'>{company.name}</span>
    </Link>
  )
}
