'use client'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { DownloadIcon, LinkIcon, MailIcon, PhoneIcon, StarIcon, Trash2Icon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { DropdownMenuGroup, DropdownMenuItem, DropdownMenuSeparator } from '@/features/nexacrm/components/ui/dropdown-menu'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useCompany } from '@/features/nexacrm/store/use-companies-store'
import { useFavoritesStore, useIsFavorite } from '@/features/nexacrm/store/use-favorites-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { downloadPersonCsv } from '@/features/nexacrm/utils/person-utils'

const PersonActions = ({ person, onRequestDelete }: { person: Person; onRequestDelete: () => void }) => {
  const { can } = useCurrentUser()
  const isFavorite = useIsFavorite('person', person.id)
  const toggleFavorite = useFavoritesStore(state => state.toggle)
  const company = useCompany(person.companyId)

  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuItem
          disabled={!person.email}
          render={person.email ? <Link href={`mailto:${person.email}`} /> : undefined}
        >
          <MailIcon /> Send email
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={!person.phone}
          render={person.phone ? <Link href={`tel:${person.phone}`} /> : undefined}
        >
          <PhoneIcon /> Call
        </DropdownMenuItem>

        <DropdownMenuItem
          disabled={!person.linkedinUrl}
          render={
            person.linkedinUrl ? (
              <Link href={person.linkedinUrl} target='_blank' rel='noopener noreferrer' />
            ) : undefined
          }
        >
          <LinkIcon /> View LinkedIn
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => toggleFavorite('person', person.id)}
          className='focus:[&>svg>*]:text-amber-500!'
        >
          <StarIcon className={cn(isFavorite && 'fill-amber-400 text-amber-500')} />
          {isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => downloadPersonCsv(person, company?.name)}>
          <DownloadIcon /> Export record
        </DropdownMenuItem>
      </DropdownMenuGroup>

      {can('records:delete') ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant='destructive' onClick={onRequestDelete}>
              <Trash2Icon /> Delete person
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </>
      ) : null}
    </>
  )
}

export default PersonActions
