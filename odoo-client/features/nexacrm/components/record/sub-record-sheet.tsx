'use client'

// React Imports
import { useState } from 'react'
import type { ReactNode } from 'react'

// Third-party Imports
import { AlignLeftIcon, CalendarIcon, MailIcon, Trash2Icon, UserIcon } from 'lucide-react'
import { toast } from 'sonner'

// Type Imports
import type { Email } from '@/features/nexacrm/types/apps/email-types'
import type { Note } from '@/features/nexacrm/types/apps/note-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'
import type { Task } from '@/features/nexacrm/types/apps/task-types'

// Component Imports
import { DropdownMenuItem } from '@/features/nexacrm/components/ui/dropdown-menu'
import EmailComposer from '@/features/nexacrm/components/record/email-composer'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import RecordSheet from '@/features/nexacrm/components/record/record-sheet'
import NoteFields, { NoteBodyEditor, NoteBodyHeading } from '@/features/nexacrm/components/record/note-fields'
import TaskFields, { TaskBodyEditor, TaskBodyHeading } from '@/features/nexacrm/components/record/task-fields'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useEmail } from '@/features/nexacrm/store/use-emails-store'
import { useNote, useNotesStore } from '@/features/nexacrm/store/use-notes-store'
import { usePersonAvatar } from '@/features/nexacrm/store/use-person-avatar'
import { useTask, useTasksStore } from '@/features/nexacrm/store/use-tasks-store'

// Util Imports
import { formatActivityTime } from '@/features/nexacrm/utils/activity-utils'
import { formatDate } from '@/features/nexacrm/utils/format'

export type SubRecordTarget = { kind: 'task' | 'note' | 'email'; id: string; isNew?: boolean }

/** The id an email target carries while it is still a draft. */
export const NEW_EMAIL = 'new'

/** Everything the sheet shell needs, whichever kind of record is open. */
type SheetView = {
  title: string
  subtitle?: string
  onRename?: (value: string) => void
  actions?: ReactNode
  body: ReactNode
}

const BodyHeading = ({ children }: { children: ReactNode }) => (
  <h3 className='flex items-center gap-1.5 text-sm font-medium'>
    <AlignLeftIcon className='text-muted-foreground size-3.5' /> {children}
  </h3>
)

const TaskBody = ({ task, canEdit }: { task: Task; canEdit: boolean }) => (
  <>
    <TaskFields task={task} canEdit={canEdit} />

    <section className='space-y-2 border-t pt-4'>
      <TaskBodyHeading />
      <TaskBodyEditor task={task} canEdit={canEdit} />
    </section>
  </>
)

const NoteBody = ({ note, canEdit }: { note: Note; canEdit: boolean }) => (
  <>
    <NoteFields note={note} canEdit={canEdit} />

    <section className='space-y-2 border-t pt-4'>
      <NoteBodyHeading />
      <NoteBodyEditor note={note} canEdit={canEdit} />
    </section>
  </>
)

const EmailBody = ({ email }: { email: Email }) => {
  const avatar = usePersonAvatar(email.fromEmail)

  return (
    <>
      <RecordGroup title='Message'>
        <RecordField type='static' label='From' icon={UserIcon}>
          <span className='flex min-w-0 items-center gap-2'>
            <PersonAvatar name={email.fromName} src={avatar} className='size-5' fallbackClassName='text-[10px]' />
            <span className='min-w-0 truncate text-sm'>{email.fromName}</span>
          </span>
        </RecordField>
        <RecordField type='static' label='To' icon={MailIcon}>
          <span className='min-w-0 truncate text-sm'>{email.toEmail ?? 'Your workspace inbox'}</span>
        </RecordField>
        {email.cc?.length ? (
          <RecordField type='static' label='Cc' icon={MailIcon}>
            <span className='min-w-0 truncate text-sm'>{email.cc.join(', ')}</span>
          </RecordField>
        ) : null}
        <RecordField type='static' label='Sent' icon={CalendarIcon}>
          <span className='text-sm'>{formatDate(email.sentAt)}</span>
        </RecordField>
      </RecordGroup>

      <section className='space-y-2 border-t pt-4'>
        <BodyHeading>Body</BodyHeading>
        <p className='text-muted-foreground text-sm leading-relaxed whitespace-pre-line'>
          {email.body || email.snippet}
        </p>
      </section>
    </>
  )
}

const useSubRecordView = (
  target: SubRecordTarget | null,
  context: { entityType: EntityType; entityId: string; defaultEmailTo?: string; onClose: () => void }
): SheetView => {
  const { can } = useCurrentUser()
  const updateTask = useTasksStore(state => state.updateTask)
  const updateNote = useNotesStore(state => state.updateNote)
  const deleteTask = useTasksStore(state => state.deleteTask)
  const deleteNote = useNotesStore(state => state.deleteNote)

  const task = useTask(target?.kind === 'task' ? target.id : undefined)
  const note = useNote(target?.kind === 'note' ? target.id : undefined)
  const email = useEmail(target?.kind === 'email' ? target.id : undefined)

  const canEdit = can('records:update')
  const canDelete = can('records:delete')

  const remove = (label: string, run: () => void) => (
    <DropdownMenuItem
      variant='destructive'
      onClick={() => {
        run()
        toast.success(`${label} deleted.`)
        context.onClose()
      }}
    >
      <Trash2Icon /> Delete {label.toLowerCase()}
    </DropdownMenuItem>
  )

  if (target?.kind === 'email' && target.id === NEW_EMAIL) {
    return {
      title: 'New email',
      body: (
        <EmailComposer
          entityType={context.entityType}
          entityId={context.entityId}
          defaultTo={context.defaultEmailTo}
          onDone={context.onClose}
        />
      )
    }
  }

  if (task) {
    return {
      title: task.title,
      subtitle: `Created ${formatActivityTime(task.createdAt)}`,
      onRename: canEdit ? title => updateTask(task.id, { title }) : undefined,
      actions: canDelete ? remove('Task', () => deleteTask(task.id)) : undefined,
      body: <TaskBody task={task} canEdit={canEdit} />
    }
  }

  if (note) {
    return {
      title: note.title,
      subtitle: `Created ${formatActivityTime(note.createdAt)}`,
      onRename: canEdit ? title => updateNote(note.id, { title }) : undefined,
      actions: canDelete ? remove('Note', () => deleteNote(note.id)) : undefined,
      body: <NoteBody note={note} canEdit={canEdit} />
    }
  }

  if (email) {
    return {
      title: email.subject,
      subtitle: `${email.direction === 'inbound' ? 'Received' : 'Sent'} ${formatActivityTime(email.sentAt)}`,
      body: <EmailBody email={email} />
    }
  }

  return { title: '', body: null }
}

const SubRecordSheet = ({
  target,
  entityType,
  entityId,
  defaultEmailTo,
  onClose
}: {
  target: SubRecordTarget | null
  entityType: EntityType
  entityId: string

  /** Pre-fills a new email's recipient with the record's first person. */
  defaultEmailTo?: string
  onClose: () => void
}) => {
  const [shown, setShown] = useState(target)

  if (target && target !== shown) setShown(target)

  const view = useSubRecordView(shown, { entityType, entityId, defaultEmailTo, onClose })

  return (
    <RecordSheet
      open={Boolean(target)}
      onOpenChange={value => (value ? undefined : onClose())}
      title={view.title}
      subtitle={view.subtitle}
      onRename={view.onRename}
      autoEditTitle={shown?.isNew}
      actions={view.actions}
    >
      {view.body}
    </RecordSheet>
  )
}

export default SubRecordSheet
