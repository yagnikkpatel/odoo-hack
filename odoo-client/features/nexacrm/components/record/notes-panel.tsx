'use client'

// Third-party Imports
import { StickyNoteIcon } from 'lucide-react'
import { toast } from 'sonner'

// Type Imports
import type { Note } from '@/features/nexacrm/types/apps/note-types'
import { buildBlankNoteInput } from '@/features/nexacrm/types/apps/note-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import RecordPanelLoader from '@/features/nexacrm/components/record/record-panel-loader'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useEntityNotes, useNotesStore } from '@/features/nexacrm/store/use-notes-store'
import { useUser } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { formatActivityTime } from '@/features/nexacrm/utils/activity-utils'

const NoteCard = ({ note, onOpen }: { note: Note; onOpen: () => void }) => {
  const author = useUser(note.createdById)

  return (
    <li>
      <Button
        variant='outline'
        onClick={onOpen}
        className='hover:bg-accent h-44 w-full flex-col items-stretch justify-between gap-0 p-0 text-left font-normal'
      >
        <span className='flex min-w-0 flex-1 flex-col overflow-hidden p-3'>
          <span className={note.title ? 'truncate text-sm font-medium' : 'text-muted-foreground truncate text-sm'}>
            {note.title || 'Untitled'}
          </span>
          {note.body ? (
            <span className='text-muted-foreground mt-1 line-clamp-4 text-sm leading-relaxed whitespace-pre-line'>
              {note.body}
            </span>
          ) : null}
        </span>

        <span className='bg-muted/30 flex shrink-0 items-center gap-2 border-t px-3 py-2'>
          <PersonAvatar
            name={author?.name ?? 'System'}
            src={author?.avatar}
            className='size-5'
            fallbackClassName='text-[10px]'
          />
          <span className='text-muted-foreground min-w-0 truncate text-xs'>
            {author?.name ?? 'System'} · {formatActivityTime(note.createdAt)}
          </span>
        </span>
      </Button>
    </li>
  )
}

const NotesPanel = ({
  entityType,
  entityId,
  onOpenNote
}: {
  entityType: EntityType
  entityId: string
  onOpenNote: (noteId: string, isNew?: boolean) => void
}) => {
  const notes = useEntityNotes(entityType, entityId)
  const hasHydrated = useNotesStore(state => state.hasHydrated)
  const addNote = useNotesStore(state => state.addNote)
  const { can } = useCurrentUser()

  const canCreate = can('records:create')

  const create = () => {
    const id = addNote(buildBlankNoteInput(), [{ entityType, entityId }])

    toast.success('Note created.')
    onOpenNote(id, true)
  }

  if (!hasHydrated) return <RecordPanelLoader />

  return (
    <div className='space-y-3'>
      <RecordHeading title='Notes' count={notes.length} onAdd={canCreate ? create : undefined} addLabel='Add note' />

      {notes.length > 0 ? (
        <ul className='grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3'>
          {notes.map(note => (
            <NoteCard key={note.id} note={note} onOpen={() => onOpenNote(note.id)} />
          ))}
        </ul>
      ) : (
        <DataTableEmptyState
          icon={StickyNoteIcon}
          title='No notes yet'
          description={
            canCreate
              ? 'Keep longer-form context here - notes also show on the timeline.'
              : 'Notes on this record appear here.'
          }
        />
      )}
    </div>
  )
}

export default NotesPanel
