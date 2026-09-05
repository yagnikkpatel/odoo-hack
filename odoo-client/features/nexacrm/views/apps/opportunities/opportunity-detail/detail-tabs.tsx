'use client'

// Third-party Imports
import { CalendarIcon, ClockIcon, ListTodoIcon, MailIcon, PaperclipIcon, StickyNoteIcon } from 'lucide-react'
import { parseAsString, useQueryState } from '@/features/nexacrm/adapters/query-state'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/nexacrm/components/ui/tabs'
import CalendarPanel from '@/features/nexacrm/components/record/calendar-panel'
import EmailsPanel from '@/features/nexacrm/components/record/emails-panel'
import FilesPanel from '@/features/nexacrm/components/record/files-panel'
import NotesPanel from '@/features/nexacrm/components/record/notes-panel'
import type { SubRecordTarget } from '@/features/nexacrm/components/record/sub-record-sheet'
import { NEW_EMAIL } from '@/features/nexacrm/components/record/sub-record-sheet'
import TasksPanel from '@/features/nexacrm/components/record/tasks-panel'
import TimelinePanel from '@/features/nexacrm/components/record/timeline-panel'

// Store Imports
import { useEntityAttachments } from '@/features/nexacrm/store/use-attachments-store'
import { useEntityCalendarEvents } from '@/features/nexacrm/store/use-calendar-events-store'
import { useEntityEmails } from '@/features/nexacrm/store/use-emails-store'
import { useEntityNotes } from '@/features/nexacrm/store/use-notes-store'
import { useRecordFeed } from '@/features/nexacrm/store/use-record-feed'
import { useEntityTasks } from '@/features/nexacrm/store/use-tasks-store'

const TAB_VALUES = ['timeline', 'tasks', 'notes', 'files', 'emails', 'calendar']

const OpportunityDetailTabs = ({
  opportunity,
  initialSection,
  onOpenSubRecord
}: {
  opportunity: Opportunity
  initialSection?: string
  onOpenSubRecord: (target: SubRecordTarget) => void
}) => {
  const entityId = opportunity.id

  const feedCount = useRecordFeed('opportunity', entityId).length
  const taskCount = useEntityTasks('opportunity', entityId).length
  const noteCount = useEntityNotes('opportunity', entityId).length
  const fileCount = useEntityAttachments('opportunity', entityId).length
  const emailCount = useEntityEmails('opportunity', entityId).length
  const eventCount = useEntityCalendarEvents('opportunity', entityId).length

  const defaultSection = initialSection && TAB_VALUES.includes(initialSection) ? initialSection : 'timeline'

  const [activeTab, setActiveTab] = useQueryState(
    'section',
    parseAsString.withDefault(defaultSection).withOptions({ history: 'push', shallow: true })
  )

  const openTask = (id: string, isNew?: boolean) => onOpenSubRecord({ kind: 'task', id, isNew })
  const openNote = (id: string, isNew?: boolean) => onOpenSubRecord({ kind: 'note', id, isNew })
  const openEmail = (id: string) => onOpenSubRecord({ kind: 'email', id })
  const composeEmail = () => onOpenSubRecord({ kind: 'email', id: NEW_EMAIL })

  const tabs = [
    {
      value: 'timeline',
      label: 'Timeline',
      icon: ClockIcon,
      count: feedCount,
      content: <TimelinePanel entityType='opportunity' entityId={entityId} onOpenNote={openNote} />
    },
    {
      value: 'tasks',
      label: 'Tasks',
      icon: ListTodoIcon,
      count: taskCount,
      content: <TasksPanel entityType='opportunity' entityId={entityId} onOpenTask={openTask} />
    },
    {
      value: 'notes',
      label: 'Notes',
      icon: StickyNoteIcon,
      count: noteCount,
      content: <NotesPanel entityType='opportunity' entityId={entityId} onOpenNote={openNote} />
    },
    {
      value: 'files',
      label: 'Files',
      icon: PaperclipIcon,
      count: fileCount,
      content: <FilesPanel entityType='opportunity' entityId={entityId} />
    },
    {
      value: 'emails',
      label: 'Emails',
      icon: MailIcon,
      count: emailCount,
      content: (
        <EmailsPanel entityType='opportunity' entityId={entityId} onOpenEmail={openEmail} onCompose={composeEmail} />
      )
    },
    {
      value: 'calendar',
      label: 'Calendar',
      icon: CalendarIcon,
      count: eventCount,
      content: <CalendarPanel entityType='opportunity' entityId={entityId} />
    }
  ]

  return (
    <Tabs
      value={activeTab}
      onValueChange={value => setActiveTab(value)}
      className='flex min-h-0 min-w-0 flex-1 flex-col gap-0'
    >
      <TabsList
        variant='line'
        className='w-full shrink-0 justify-start overflow-x-auto rounded-none border-b px-2 pb-1 group-data-horizontal/tabs:h-10'
      >
        {tabs.map(tab => (
          <TabsTrigger key={tab.value} value={tab.value} className='shrink-0'>
            <tab.icon className='size-3.5' />
            {tab.label}
            {tab.count ? (
              <Badge variant='outline' className='text-[11px] tabular-nums'>
                {tab.count}
              </Badge>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>

      <ScrollArea className='xl:min-h-0 xl:flex-1'>
        {tabs.map(tab => (
          <TabsContent key={tab.value} value={tab.value} className='min-w-0 pt-4 pb-4 xl:px-4 xl:pb-0'>
            {tab.content}
          </TabsContent>
        ))}
      </ScrollArea>
    </Tabs>
  )
}

export default OpportunityDetailTabs
