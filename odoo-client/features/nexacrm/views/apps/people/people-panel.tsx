'use client'

// React Imports
import { useRef, useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'
import {
  CalendarIcon,
  ChevronDownIcon,
  ClockIcon,
  HomeIcon,
  ListTodoIcon,
  MailIcon,
  PaperclipIcon,
  StarIcon,
  StickyNoteIcon,
  XIcon
} from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Button } from '@/features/nexacrm/components/ui/button'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/nexacrm/components/ui/tabs'
import type { SubRecordTarget } from '@/features/nexacrm/components/record/sub-record-sheet'
import SubRecordSheet, { NEW_EMAIL } from '@/features/nexacrm/components/record/sub-record-sheet'
import PreviewSheet from '@/features/nexacrm/components/record/preview-sheet'
import TimelinePanel from '@/features/nexacrm/components/record/timeline-panel'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import EditableTitle from '@/features/nexacrm/components/record/editable-title'
import CalendarPanel from '@/features/nexacrm/components/record/calendar-panel'
import EmailsPanel from '@/features/nexacrm/components/record/emails-panel'
import FilesPanel from '@/features/nexacrm/components/record/files-panel'
import NotesPanel from '@/features/nexacrm/components/record/notes-panel'
import TasksPanel from '@/features/nexacrm/components/record/tasks-panel'

// Type Imports
import { formatPersonName, personDisplayName, splitPersonName } from '@/features/nexacrm/types/apps/person-types'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { usePeopleStore, usePerson } from '@/features/nexacrm/store/use-people-store'
import { useEntityAttachments } from '@/features/nexacrm/store/use-attachments-store'
import { useEntityCalendarEvents } from '@/features/nexacrm/store/use-calendar-events-store'
import { useEntityEmails } from '@/features/nexacrm/store/use-emails-store'
import { useEntityNotes } from '@/features/nexacrm/store/use-notes-store'
import { useRecordFeed } from '@/features/nexacrm/store/use-record-feed'
import { useEntityTasks } from '@/features/nexacrm/store/use-tasks-store'
import { useIsFavorite } from '@/features/nexacrm/store/use-favorites-store'

// Util Imports
import { formatDate } from '@/features/nexacrm/utils/format'

// Local Imports
import PersonActions from './person-actions'
import PersonFields from './person-detail/person-fields'

/** Query key holding the previewed record id. Exported so the list can open the panel. */
export const RECORD_PARAM = 'record'

const VISIBLE_TABS = 4

const PANEL_TABS = [
  { value: 'home', label: 'Home', icon: HomeIcon },
  { value: 'timeline', label: 'Timeline', icon: ClockIcon },
  { value: 'tasks', label: 'Tasks', icon: ListTodoIcon },
  { value: 'notes', label: 'Notes', icon: StickyNoteIcon },
  { value: 'files', label: 'Files', icon: PaperclipIcon },
  { value: 'emails', label: 'Emails', icon: MailIcon },
  { value: 'calendar', label: 'Calendar', icon: CalendarIcon }
]

export const usePersonPreview = () =>
  useQueryState(RECORD_PARAM, parseAsString.withOptions({ history: 'push', shallow: true }))

const PersonPanel = () => {
  const [recordId, setRecordId] = usePersonPreview()

  const headingRef = useRef<HTMLDivElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [subRecord, setSubRecord] = useState<SubRecordTarget | null>(null)

  const open = usePerson(recordId ?? undefined)

  const [person, setPerson] = useState(open)

  if (open && open !== person) setPerson(open)

  const deletePerson = usePeopleStore(state => state.deletePerson)
  const updatePerson = usePeopleStore(state => state.updatePerson)
  const { can } = useCurrentUser()

  const canEdit = can('records:update')
  const isFavorite = useIsFavorite('person', person?.id ?? '')

  const isNew = Boolean(person && !person.firstName.trim() && !person.lastName.trim())

  const [panelTab, setPanelTab] = useState('home')

  const entityId = person?.id ?? ''

  const counts: Record<string, number> = {
    timeline: useRecordFeed('person', entityId).length,
    tasks: useEntityTasks('person', entityId).length,
    notes: useEntityNotes('person', entityId).length,
    files: useEntityAttachments('person', entityId).length,
    emails: useEntityEmails('person', entityId).length,
    calendar: useEntityCalendarEvents('person', entityId).length
  }

  const close = () => setRecordId(null)

  const handleDelete = () => {
    if (!person) return

    deletePerson(person.id)
    toast.success(`${personDisplayName(person)} deleted.`)
    close()
  }

  return (
    <PreviewSheet
      open={Boolean(open)}
      onClose={close}
      title={`${person ? personDisplayName(person) || 'Untitled' : 'Record'} details`}
      initialFocus={headingRef}
    >
      {person ? (
        <>
          <div
            ref={headingRef}
            tabIndex={-1}
            className='flex h-12.5 shrink-0 items-center gap-2 border-b px-4 outline-none'
          >
            <PersonAvatar name={personDisplayName(person)} src={person.avatar} size='default' />
            <div className='min-w-0 flex-1'>
              <EditableTitle
                key={person.id}
                value={formatPersonName(person)}
                canEdit={canEdit}
                autoEdit={isNew}
                placeholder='Name'
                onCommit={raw => updatePerson(person.id, splitPersonName(raw))}
                ariaLabel='Name'
                className='text-sm font-medium'
              />
              <p className='text-muted-foreground truncate text-xs'>
                {isNew ? 'Created now' : `Added ${formatDate(person.createdAt)}`}
              </p>
            </div>
            {isFavorite ? <StarIcon className='size-4 shrink-0 fill-amber-400 text-amber-500' /> : null}
            {person.isPrimary ? (
              <Badge variant='secondary' className='shrink-0'>
                Primary
              </Badge>
            ) : null}
            <Button variant='ghost' size='icon-sm' aria-label='Close panel' onClick={close}>
              <XIcon />
            </Button>
          </div>

          <Tabs value={panelTab} onValueChange={setPanelTab} className='flex min-h-0 flex-1 flex-col gap-0'>
            <div className='flex shrink-0 items-center gap-1 border-b pe-2'>
              <TabsList
                variant='line'
                className='min-w-0 flex-1 scrollbar-none justify-start overflow-x-auto rounded-none border-0 px-2 pb-1 group-data-horizontal/tabs:h-10'
              >
                {PANEL_TABS.slice(0, VISIBLE_TABS).map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className='shrink-0 gap-1.5 px-2'>
                    <tab.icon className='size-3.5' />
                    {tab.label}
                    {counts[tab.value] ? (
                      <span className='text-muted-foreground text-[11px] tabular-nums'>{counts[tab.value]}</span>
                    ) : null}
                  </TabsTrigger>
                ))}

                {PANEL_TABS.slice(VISIBLE_TABS).map(tab => (
                  <TabsTrigger key={tab.value} value={tab.value} className='sr-only'>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button variant='ghost' size='sm' aria-label='More tabs' className='shrink-0' />}
                >
                  +{PANEL_TABS.length - VISIBLE_TABS}
                  <ChevronDownIcon />
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end' className='w-40'>
                  <DropdownMenuGroup>
                    {PANEL_TABS.slice(VISIBLE_TABS).map(tab => (
                      <DropdownMenuItem key={tab.value} onClick={() => setPanelTab(tab.value)}>
                        <tab.icon /> {tab.label}
                        {counts[tab.value] ? (
                          <span className='text-muted-foreground ms-auto text-xs tabular-nums'>
                            {counts[tab.value]}
                          </span>
                        ) : null}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <ScrollArea className='min-h-0 flex-1'>
              <div className='p-4'>
                <TabsContent value='home'>
                  <PersonFields person={person} />
                </TabsContent>
                <TabsContent value='timeline'>
                  <TimelinePanel
                    entityType='person'
                    entityId={person.id}
                    onOpenNote={id => setSubRecord({ kind: 'note', id })}
                  />
                </TabsContent>
                <TabsContent value='tasks'>
                  <TasksPanel
                    entityType='person'
                    entityId={person.id}
                    onOpenTask={(id, isNew) => setSubRecord({ kind: 'task', id, isNew })}
                  />
                </TabsContent>
                <TabsContent value='notes'>
                  <NotesPanel
                    entityType='person'
                    entityId={person.id}
                    onOpenNote={(id, isNew) => setSubRecord({ kind: 'note', id, isNew })}
                  />
                </TabsContent>
                <TabsContent value='files'>
                  <FilesPanel entityType='person' entityId={person.id} />
                </TabsContent>
                <TabsContent value='emails'>
                  <EmailsPanel
                    entityType='person'
                    entityId={person.id}
                    onOpenEmail={id => setSubRecord({ kind: 'email', id })}
                    onCompose={() => setSubRecord({ kind: 'email', id: NEW_EMAIL })}
                  />
                </TabsContent>
                <TabsContent value='calendar'>
                  <CalendarPanel entityType='person' entityId={person.id} />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          <div className='flex shrink-0 items-center justify-between gap-2 border-t p-3'>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant='outline' size='sm' />}>Options</DropdownMenuTrigger>
              <DropdownMenuContent align='start' className='w-52'>
                <PersonActions person={person} onRequestDelete={() => setConfirmOpen(true)} />
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size='sm' render={<Link href={`/employees/${person.id}`} />} nativeButton={false}>
              Open
            </Button>
          </div>
          <SubRecordSheet
            target={subRecord}
            entityType='person'
            entityId={person.id}
            defaultEmailTo={person.email}
            onClose={() => setSubRecord(null)}
          />

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title='Delete person'
            description={`${personDisplayName(person)} will be removed from your workspace. This cannot be undone.`}
            confirmLabel='Delete'
            onConfirm={handleDelete}
          />
        </>
      ) : null}
    </PreviewSheet>
  )
}

export default PersonPanel
