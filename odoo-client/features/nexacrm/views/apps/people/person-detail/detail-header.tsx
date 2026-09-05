'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ArrowLeftIcon, EllipsisVerticalIcon, MailIcon, StarIcon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { formatPersonName, personDisplayName, splitPersonName } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Button } from '@/features/nexacrm/components/ui/button'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/features/nexacrm/components/ui/dropdown-menu'
import { SidePanelTrigger } from '@/features/nexacrm/components/layout/side-panel'
import EditableTitle from '@/features/nexacrm/components/record/editable-title'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import RecordNavigation from '@/features/nexacrm/components/record/record-navigation'

// Local Imports
import PersonActions from '../person-actions'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { usePeopleStore, usePersonNavigation } from '@/features/nexacrm/store/use-people-store'
import { useFavoritesStore, useIsFavorite } from '@/features/nexacrm/store/use-favorites-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

const PersonDetailHeader = ({
  person,
  onDelete,
  onOpenPanel,
  onComposeEmail
}: {
  person: Person
  onDelete: () => void
  onOpenPanel: () => void

  /** Opens the email composer sheet - the same target the Emails tab's "+" uses. */
  onComposeEmail: () => void
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { can } = useCurrentUser()
  const { index, total, previousId, nextId } = usePersonNavigation(person.id)
  const updatePerson = usePeopleStore(state => state.updatePerson)
  const isFavorite = useIsFavorite('person', person.id)
  const toggleFavorite = useFavoritesStore(state => state.toggle)

  const canEdit = can('records:update')
  const name = formatPersonName(person)

  return (
    <div className='flex shrink-0 items-center gap-3 border-b py-2'>
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Back to people'
        nativeButton={false}
        render={<Link href='/employees' />}
        className='text-muted-foreground hover:text-foreground -ml-1 shrink-0'
      >
        <ArrowLeftIcon />
      </Button>

      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2'>
          <PersonAvatar name={personDisplayName(person)} src={person.avatar} size='default' />

          <h1 className='min-w-0'>
            <EditableTitle
              key={person.id}
              value={name}
              canEdit={canEdit}
              placeholder='Name'
              onCommit={raw => updatePerson(person.id, splitPersonName(raw))}
              ariaLabel='Name'
              className='text-base font-semibold tracking-tight'
            />
          </h1>

          {person.isPrimary ? (
            <Badge variant='secondary' className='shrink-0 max-sm:hidden'>
              Primary
            </Badge>
          ) : null}

          {person.jobTitle ? (
            <span className='text-muted-foreground shrink-0 truncate text-xs max-lg:hidden'>{person.jobTitle}</span>
          ) : null}
        </div>
      </div>

      <div className='flex shrink-0 items-center gap-1'>
        {canEdit ? (
          <Button variant='outline' size='sm' onClick={onComposeEmail} className='mr-1 shrink-0'>
            <MailIcon />
            <span className='max-sm:hidden'>Send Email</span>
          </Button>
        ) : null}

        <RecordNavigation
          index={index}
          total={total}
          moduleLabel='People'
          previousHref={previousId ? `/employees/${previousId}` : undefined}
          nextHref={nextId ? `/employees/${nextId}` : undefined}
        />

        <SidePanelTrigger side='left' breakpoint='xl' label='Show person details' onClick={onOpenPanel} />

        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite('person', person.id)}
          className={cn('text-muted-foreground', isFavorite && 'text-amber-500 hover:text-amber-500!')}
        >
          <StarIcon className={cn(isFavorite && 'fill-amber-400')} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon-sm'
                aria-label='Person actions'
                className='text-muted-foreground hover:text-foreground'
              />
            }
          >
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-52'>
            <PersonActions person={person} onRequestDelete={() => setConfirmOpen(true)} />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {can('records:delete') ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title='Delete person'
          description={`${name} will be removed from your workspace. This cannot be undone.`}
          confirmLabel='Delete'
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  )
}

export default PersonDetailHeader
