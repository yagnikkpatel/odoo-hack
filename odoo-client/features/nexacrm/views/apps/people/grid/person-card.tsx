'use client'

// Third-party Imports
import { BuildingIcon, MailIcon, PhoneIcon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import CompanyAvatar from '@/features/nexacrm/components/record/company-avatar'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'

// Store Imports
import { useCompany } from '@/features/nexacrm/store/use-companies-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

const FieldRow = ({
  icon: Icon,
  value,
  placeholder
}: {
  icon: typeof MailIcon
  value: string
  placeholder: string
}) => (
  <span className='flex min-w-0 items-center gap-1.5'>
    <Icon className='text-muted-foreground/70 size-3.5 shrink-0' />
    <span className={cn('truncate text-[0.8rem]', value ? 'text-foreground/75' : 'text-muted-foreground/45')}>
      {value || placeholder}
    </span>
  </span>
)

const PersonCard = ({ person, onOpen }: { person: Person; onOpen: () => void }) => {
  const company = useCompany(person.companyId)

  return (
    <li>
      <Button
        variant='outline'
        onClick={onOpen}
        className='hover:border-primary/40 dark:hover:border-primary/40 h-auto w-full flex-col items-stretch gap-0 overflow-hidden p-0 text-left font-normal transition-colors'
      >
        <Card className='gap-0 rounded-none border-0 bg-transparent py-0 shadow-none'>
          <CardContent className='flex flex-col gap-3 p-4'>
            <span className='flex items-start gap-3'>
              <PersonAvatar name={personDisplayName(person)} src={person.avatar} className='size-10' />

              <span className='flex min-w-0 flex-1 flex-col'>
                <span
                  className={cn(
                    'min-w-0 truncate text-sm font-medium',
                    !person.firstName && !person.lastName && 'text-muted-foreground font-normal'
                  )}
                >
                  {personDisplayName(person)}
                </span>
                <span className='text-muted-foreground truncate text-xs'>{person.jobTitle || 'No job title'}</span>
              </span>
            </span>

            <span className='flex flex-col gap-1'>
              <FieldRow icon={MailIcon} value={person.email} placeholder='No email' />
              <FieldRow icon={PhoneIcon} value={person.phone ?? ''} placeholder='No phone' />
            </span>

            <span className='flex items-center gap-2 border-t pt-3'>
              {company ? (
                <>
                  <CompanyAvatar company={company} />
                  <span className='text-foreground/70 truncate text-[0.8rem]'>{company.name || 'Untitled'}</span>
                </>
              ) : (
                <>
                  <BuildingIcon className='text-muted-foreground/45 size-4 shrink-0' />
                  <span className='text-muted-foreground/45 truncate text-[0.8rem]'>No company</span>
                </>
              )}
            </span>
          </CardContent>
        </Card>
      </Button>
    </li>
  )
}

export default PersonCard
