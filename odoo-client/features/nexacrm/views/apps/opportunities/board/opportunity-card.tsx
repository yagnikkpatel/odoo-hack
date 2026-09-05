'use client'

// React Imports
import type { ComponentProps, ReactNode } from 'react'

// Third-party Imports
import type { LucideIcon } from 'lucide-react'
import {
  Building2Icon,
  CalendarIcon,
  DollarSignIcon,
  EllipsisVerticalIcon,
  ExternalLinkIcon,
  Trash2Icon,
  UserPlusIcon,
  UserRoundIcon
} from 'lucide-react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { opportunityDisplayName } from '@/features/nexacrm/types/apps/opportunity-types'
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent } from '@/features/nexacrm/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'
import type { KanbanCardMode } from '@/features/nexacrm/components/kanban/record-kanban'
import { isCardClickable, isCardDraggable } from '@/features/nexacrm/components/kanban/record-kanban'
import { KanbanItem } from '@/features/nexacrm/components/ui/kanban'
import CompanyAvatar from '@/features/nexacrm/components/record/company-avatar'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'

// Store Imports
import { useCompany } from '@/features/nexacrm/store/use-companies-store'
import { usePerson } from '@/features/nexacrm/store/use-people-store'
import { useUser } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { formatCompactCurrency, formatDate } from '@/features/nexacrm/utils/format'

type OpportunityCardProps = ComponentProps<typeof Card> & {
  opportunity: Opportunity
  mode?: KanbanCardMode
  onOpen?: () => void
  onDelete?: () => void
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

const OpportunityCard = ({
  opportunity,
  mode = 'board',
  onOpen,
  onDelete,
  className,
  ...props
}: OpportunityCardProps) => {
  const company = useCompany(opportunity.companyId)
  const pointOfContact = usePerson(opportunity.pointOfContactId)
  const createdBy = useUser(opportunity.createdById)
  const clickable = isCardClickable(mode)
  const draggable = isCardDraggable(mode)

  const label = opportunityDisplayName(opportunity)

  const card = (
    <Card
      onClick={clickable ? onOpen : undefined}
      className={cn(
        'gap-0 py-0 shadow-none',
        clickable && 'hover:ring-primary/40 cursor-pointer transition-colors',
        mode === 'dragged' && 'rotate-1 shadow-xl',
        className
      )}
      {...props}
    >
      <CardContent className='flex flex-col gap-2.5 p-3'>
        <div className='flex items-start gap-2'>
          <span
            className={cn(
              'min-w-0 flex-1 text-sm font-medium',
              !opportunity.name.trim() && 'text-muted-foreground font-normal'
            )}
          >
            {label}
          </span>

          {onDelete ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                onClick={event => event.stopPropagation()}
                render={<Button variant='ghost' size='icon-sm' aria-label={`Actions for ${label}`} />}
              >
                <EllipsisVerticalIcon className='size-3.5' />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-40'>
                <DropdownMenuItem onClick={onOpen}>
                  <ExternalLinkIcon /> Open
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant='destructive' onClick={onDelete}>
                  <Trash2Icon /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <div className='flex flex-col gap-0.5'>
          <CardField icon={DollarSignIcon} label='Amount'>
            {opportunity.amount ? (
              <span className='tabular-nums'>{formatCompactCurrency(opportunity.amount)}</span>
            ) : null}
          </CardField>

          <CardField icon={UserPlusIcon} label='Created by'>
            {createdBy ? (
              <>
                <PersonAvatar
                  name={createdBy.name}
                  src={createdBy.avatar}
                  className='size-4!'
                  fallbackClassName='text-[9px]'
                />
                <span className='truncate'>{createdBy.name}</span>
              </>
            ) : (
              <span className='truncate'>System</span>
            )}
          </CardField>

          <CardField icon={CalendarIcon} label='Close date'>
            {opportunity.closeDate ? <span>{formatDate(opportunity.closeDate)}</span> : null}
          </CardField>

          <CardField icon={Building2Icon} label='Company'>
            {company ? (
              <>
                <CompanyAvatar company={company} className='size-4!' fallbackClassName='text-[9px]' />
                <span className='truncate'>{company.name.trim() || 'Untitled'}</span>
              </>
            ) : null}
          </CardField>

          <CardField icon={UserRoundIcon} label='Point of Contact'>
            {pointOfContact ? (
              <>
                <PersonAvatar
                  name={personDisplayName(pointOfContact)}
                  src={pointOfContact.avatar}
                  className='size-4!'
                  fallbackClassName='text-[9px]'
                />
                <span className='truncate'>{personDisplayName(pointOfContact)}</span>
              </>
            ) : null}
          </CardField>
        </div>
      </CardContent>
    </Card>
  )

  return draggable ? <KanbanItem value={opportunity.id}>{card}</KanbanItem> : card
}

export default OpportunityCard
