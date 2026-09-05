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
  ExternalLinkIcon,
  HomeIcon,
  ListTodoIcon,
  MailIcon,
  PaperclipIcon,
  StickyNoteIcon,
  Trash2Icon,
  XIcon
} from 'lucide-react'
import { toast } from 'sonner'

// Type Imports
import { opportunityDisplayName } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
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
import CalendarPanel from '@/features/nexacrm/components/record/calendar-panel'
import EditableTitle from '@/features/nexacrm/components/record/editable-title'
import EmailsPanel from '@/features/nexacrm/components/record/emails-panel'
import FilesPanel from '@/features/nexacrm/components/record/files-panel'
import NotesPanel from '@/features/nexacrm/components/record/notes-panel'
import OpportunityFields from '@/features/nexacrm/components/record/opportunity-fields'
import PreviewSheet from '@/features/nexacrm/components/record/preview-sheet'
import type { SubRecordTarget } from '@/features/nexacrm/components/record/sub-record-sheet'
import SubRecordSheet, { NEW_EMAIL } from '@/features/nexacrm/components/record/sub-record-sheet'
import TasksPanel from '@/features/nexacrm/components/record/tasks-panel'
import TimelinePanel from '@/features/nexacrm/components/record/timeline-panel'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useEntityAttachments } from '@/features/nexacrm/store/use-attachments-store'
import { useEntityCalendarEvents } from '@/features/nexacrm/store/use-calendar-events-store'
import { useEntityEmails } from '@/features/nexacrm/store/use-emails-store'
import { useEntityNotes } from '@/features/nexacrm/store/use-notes-store'
import { useOpportunitiesStore, useOpportunity } from '@/features/nexacrm/store/use-opportunities-store'
import { usePerson } from '@/features/nexacrm/store/use-people-store'
import { useRecordFeed } from '@/features/nexacrm/store/use-record-feed'
import { useEntityTasks } from '@/features/nexacrm/store/use-tasks-store'

// Util Imports
import { formatDate } from '@/features/nexacrm/utils/format'

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

export const useOpportunityPreview = () =>
  useQueryState(RECORD_PARAM, parseAsString.withOptions({ history: 'push', shallow: true }))

const OpportunityPanel = () => {
  const [recordId, setRecordId] = useOpportunityPreview()

  const headingRef = useRef<HTMLDivElement>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [panelTab, setPanelTab] = useState('home')
  const [subRecord, setSubRecord] = useState<SubRecordTarget | null>(null)

  const open = useOpportunity(recordId ?? undefined)

  const [opportunity, setOpportunity] = useState(open)

  if (open && open !== opportunity) setOpportunity(open)

  const updateOpportunity = useOpportunitiesStore(state => state.updateOpportunity)
  const deleteOpportunity = useOpportunitiesStore(state => state.deleteOpportunity)
  const { can } = useCurrentUser()

  const canEdit = can('records:update')

  const entityId = opportunity?.id ?? ''

  const counts: Record<string, number> = {
    timeline: useRecordFeed('opportunity', entityId).length,
    tasks: useEntityTasks('opportunity', entityId).length,
    notes: useEntityNotes('opportunity', entityId).length,
    files: useEntityAttachments('opportunity', entityId).length,
    emails: useEntityEmails('opportunity', entityId).length,
    calendar: useEntityCalendarEvents('opportunity', entityId).length
  }

  const pointOfContact = usePerson(opportunity?.pointOfContactId)

  const isNew = Boolean(opportunity && !opportunity.name.trim())

  const close = () => setRecordId(null)

  const handleDelete = () => {
    if (!opportunity) return

    deleteOpportunity(opportunity.id)
    toast.success(`${opportunityDisplayName(opportunity)} deleted.`)
    close()
  }

  return (
    <PreviewSheet
      open={Boolean(open)}
      onClose={close}
      title={`${opportunity ? opportunityDisplayName(opportunity) : 'Opportunity'} details`}
      initialFocus={headingRef}
    >
      {opportunity ? (
        <>
          <div
            ref={headingRef}
            tabIndex={-1}
            className='flex h-12.5 shrink-0 items-center gap-2 border-b px-4 outline-none'
          >
            <div className='min-w-0 flex-1'>
              <EditableTitle
                key={opportunity.id}
                value={opportunity.name}
                canEdit={canEdit}
                autoEdit={isNew}
                onCommit={name => updateOpportunity(opportunity.id, { name })}
                ariaLabel='Opportunity name'
                className='h-7 border-transparent bg-transparent px-1 text-sm font-medium shadow-none'
              />
              <p className='text-muted-foreground truncate text-xs'>
                {isNew ? 'Created now' : `Added ${formatDate(opportunity.createdAt)}`}
              </p>
            </div>
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
                  <OpportunityFields opportunity={opportunity} canEdit={canEdit} />
                </TabsContent>
                <TabsContent value='timeline'>
                  <TimelinePanel
                    entityType='opportunity'
                    entityId={opportunity.id}
                    onOpenNote={id => setSubRecord({ kind: 'note', id })}
                  />
                </TabsContent>
                <TabsContent value='tasks'>
                  <TasksPanel
                    entityType='opportunity'
                    entityId={opportunity.id}
                    onOpenTask={(id, isNew) => setSubRecord({ kind: 'task', id, isNew })}
                  />
                </TabsContent>
                <TabsContent value='notes'>
                  <NotesPanel
                    entityType='opportunity'
                    entityId={opportunity.id}
                    onOpenNote={(id, isNew) => setSubRecord({ kind: 'note', id, isNew })}
                  />
                </TabsContent>
                <TabsContent value='files'>
                  <FilesPanel entityType='opportunity' entityId={opportunity.id} />
                </TabsContent>
                <TabsContent value='emails'>
                  <EmailsPanel
                    entityType='opportunity'
                    entityId={opportunity.id}
                    onOpenEmail={id => setSubRecord({ kind: 'email', id })}
                    onCompose={() => setSubRecord({ kind: 'email', id: NEW_EMAIL })}
                  />
                </TabsContent>
                <TabsContent value='calendar'>
                  <CalendarPanel entityType='opportunity' entityId={opportunity.id} />
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>

          <SubRecordSheet
            target={subRecord}
            entityType='opportunity'
            entityId={opportunity.id}
            defaultEmailTo={pointOfContact?.email}
            onClose={() => setSubRecord(null)}
          />

          <div className='flex shrink-0 items-center justify-between gap-2 border-t p-3'>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant='outline' size='sm' />}>Options</DropdownMenuTrigger>
              <DropdownMenuContent align='start' className='w-56'>
                <DropdownMenuGroup>
                  <DropdownMenuItem render={<Link href={`/opportunities/${opportunity.id}`} />}>
                    <ExternalLinkIcon /> Open record
                  </DropdownMenuItem>
                  {can('records:delete') ? (
                    <DropdownMenuItem variant='destructive' onClick={() => setConfirmOpen(true)}>
                      <Trash2Icon /> Delete opportunity
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button size='sm' render={<Link href={`/opportunities/${opportunity.id}`} />} nativeButton={false}>
              Open
            </Button>
          </div>

          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title='Delete opportunity'
            description={`${opportunityDisplayName(opportunity)} will be permanently removed. This cannot be undone.`}
            confirmLabel='Delete'
            onConfirm={handleDelete}
          />
        </>
      ) : null}
    </PreviewSheet>
  )
}

export default OpportunityPanel
