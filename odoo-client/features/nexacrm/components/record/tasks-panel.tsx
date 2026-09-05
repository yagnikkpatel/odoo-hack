'use client'

// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { CalendarIcon, ListTodoIcon } from 'lucide-react'
import { toast } from 'sonner'

// Type Imports
import type { Task } from '@/features/nexacrm/types/apps/task-types'
import { buildBlankTaskInput, isTaskDone, isTaskOverdue } from '@/features/nexacrm/types/apps/task-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import DataTableEmptyState from '@/features/nexacrm/components/data-table/data-table-empty-state'
import RecordPanelLoader from '@/features/nexacrm/components/record/record-panel-loader'
import { RecordHeading, RecordSubHeading } from '@/features/nexacrm/components/record/record-section'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useEntityTasks, useTasksStore } from '@/features/nexacrm/store/use-tasks-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { formatDate } from '@/features/nexacrm/utils/format'

const GROUPS = [
  { key: 'todo', label: 'To do' },
  { key: 'done', label: 'Done' }
] as const

const byDueDate = (a: Task, b: Task) =>
  a.dueAt && b.dueAt ? a.dueAt.localeCompare(b.dueAt) : (a.dueAt ? 0 : 1) - (b.dueAt ? 0 : 1)

const TaskRow = ({ task, onOpen }: { task: Task; onOpen: () => void }) => {
  const setTaskStatus = useTasksStore(state => state.setTaskStatus)
  const done = isTaskDone(task.status)
  const label = task.title || 'Untitled'

  return (
    <li className='hover:bg-accent flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors'>
      <Checkbox
        checked={done}
        aria-label={done ? `Mark ${label} as not done` : `Mark ${label} as done`}
        onCheckedChange={checked => setTaskStatus(task.id, checked ? 'done' : 'todo')}
      />

      <Button
        variant='ghost'
        onClick={onOpen}
        className='-mx-2 h-auto min-w-0 flex-1 justify-start gap-2 px-2 py-1 text-left font-normal hover:bg-transparent'
      >
        <span
          className={cn(
            'min-w-0 truncate text-sm font-medium',
            done && 'text-muted-foreground line-through',
            !task.title && 'text-muted-foreground font-normal'
          )}
        >
          {label}
        </span>
        {task.body ? (
          <span className='text-muted-foreground hidden min-w-0 truncate text-sm sm:inline'>{task.body}</span>
        ) : null}
      </Button>

      {task.dueAt && !done ? (
        <span
          className={cn(
            'flex shrink-0 items-center gap-1 text-xs whitespace-nowrap',
            isTaskOverdue(task) ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          <CalendarIcon className='size-3.5' />
          {formatDate(task.dueAt)}
        </span>
      ) : null}
    </li>
  )
}

const TasksPanel = ({
  entityType,
  entityId,
  onOpenTask
}: {
  entityType: EntityType
  entityId: string
  onOpenTask: (taskId: string, isNew?: boolean) => void
}) => {
  const tasks = useEntityTasks(entityType, entityId)
  const hasHydrated = useTasksStore(state => state.hasHydrated)
  const addTask = useTasksStore(state => state.addTask)
  const { user, can } = useCurrentUser()

  const groups = useMemo(
    () =>
      GROUPS.map(group => ({
        ...group,
        items: tasks
          .filter(task => (group.key === 'done' ? isTaskDone(task.status) : !isTaskDone(task.status)))
          .sort(byDueDate)
      })).filter(group => group.items.length > 0),
    [tasks]
  )

  const canCreate = can('records:create')

  const create = () => {
    const id = addTask(buildBlankTaskInput(user.id), [{ entityType, entityId }])

    toast.success('Task created.')
    onOpenTask(id, true)
  }

  if (!hasHydrated) return <RecordPanelLoader />

  return (
    <div className='space-y-3'>
      <RecordHeading title='Tasks' count={tasks.length} onAdd={canCreate ? create : undefined} addLabel='Add task' />

      {groups.length > 0 ? (
        <div className='space-y-4'>
          {groups.map(group => (
            <section key={group.key}>
              <RecordSubHeading title={group.label} count={group.items.length} />
              <ul className='space-y-2'>
                {group.items.map(task => (
                  <TaskRow key={task.id} task={task} onOpen={() => onOpenTask(task.id)} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <DataTableEmptyState
          icon={ListTodoIcon}
          title='No tasks yet'
          description={
            canCreate ? 'Add a task to track the next steps on this record.' : 'Tasks on this record appear here.'
          }
        />
      )}
    </div>
  )
}

export default TasksPanel
