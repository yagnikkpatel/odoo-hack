'use client'

// Third-party Imports
import { AlignLeftIcon, ArrowUpRightIcon, CalendarIcon, CircleDotIcon, UserIcon, UserPlusIcon } from 'lucide-react'

// Type Imports
import type { Task, TaskStatus } from '@/features/nexacrm/types/apps/task-types'
import { NO_STATUS, taskStatusLabel, taskStatusTone } from '@/features/nexacrm/types/apps/task-types'
import { UNASSIGNED_OWNER, toUserOption } from '@/features/nexacrm/types/apps/user-types'

// Component Imports
import { Textarea } from '@/features/nexacrm/components/ui/textarea'
import DateTimeField from '@/features/nexacrm/components/record/date-time-field'
import StageBadge from '@/features/nexacrm/components/kanban/stage-badge'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordTargetsField } from '@/features/nexacrm/components/record/record-targets'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import UserChip from '@/features/nexacrm/components/record/user-chip'

// Store Imports
import { useTaskRefs, useTasksStore } from '@/features/nexacrm/store/use-tasks-store'
import { useTaskStagesStore } from '@/features/nexacrm/store/use-task-stages-store'
import { useStageOptions } from '@/features/nexacrm/store/create-stages-store'
import { useUser, useUsersStore } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { formatDate } from '@/features/nexacrm/utils/format'

const DueDateField = ({ task, canEdit }: { task: Task; canEdit: boolean }) => {
  const updateTask = useTasksStore(state => state.updateTask)

  return (
    <RecordField type='static' label='Due date' icon={CalendarIcon}>
      <DateTimeField
        value={task.dueAt}
        canEdit={canEdit}
        placeholder='Add a due date'
        onChange={dueAt => updateTask(task.id, { dueAt })}
      />
    </RecordField>
  )
}

export const TaskBodyEditor = ({ task, canEdit, className }: { task: Task; canEdit: boolean; className?: string }) => {
  const updateTask = useTasksStore(state => state.updateTask)

  return canEdit ? (
    <Textarea
      value={task.body ?? ''}
      aria-label='Task body'
      placeholder='Add more detail…'
      onChange={event => updateTask(task.id, { body: event.target.value || undefined })}
      className={cn(
        'resize-none border-transparent text-sm leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent',
        className ?? 'min-h-32'
      )}
    />
  ) : (
    <p className='text-muted-foreground text-sm leading-relaxed whitespace-pre-line'>
      {task.body || 'No description yet.'}
    </p>
  )
}

/** The heading above a record's own prose, matching the sub-record sheet. */
export const TaskBodyHeading = () => (
  <h3 className='flex items-center gap-1.5 text-sm font-medium'>
    <AlignLeftIcon className='text-muted-foreground size-3.5' /> Description
  </h3>
)

const TaskFields = ({ task, canEdit }: { task: Task; canEdit: boolean }) => {
  const updateTask = useTasksStore(state => state.updateTask)
  const setTaskTargets = useTasksStore(state => state.setTaskTargets)
  const refs = useTaskRefs(task.id)

  const stageOptions = useStageOptions(useTaskStagesStore)
  const users = useUsersStore(state => state.users)
  const assignee = useUser(task.assigneeId)

  const assigneeOptions = [{ label: 'Unassigned', value: UNASSIGNED_OWNER }, ...users.map(toUserOption)]

  return (
    <div className='space-y-4'>
      <RecordGroup title='General'>
        <DueDateField task={task} canEdit={canEdit} />

        <RecordField
          type='select'
          label='Status'
          icon={CircleDotIcon}
          canEdit={canEdit}
          value={task.status ?? NO_STATUS}
          options={stageOptions}
          onChange={value => updateTask(task.id, { status: value === NO_STATUS ? undefined : (value as TaskStatus) })}
        >
          <StageBadge
            stagesStore={useTaskStagesStore}
            stage={task.status ?? NO_STATUS}
            fallbackLabel={taskStatusLabel(task.status)}
            fallbackTone={taskStatusTone(task.status)}
          />
        </RecordField>

        <RecordField
          type='select'
          label='Assignee'
          icon={UserIcon}
          canEdit={canEdit}
          value={task.assigneeId ?? UNASSIGNED_OWNER}
          options={assigneeOptions}
          onChange={value => updateTask(task.id, { assigneeId: value === UNASSIGNED_OWNER ? undefined : value })}
        >
          {assignee ? (
            <span className='flex min-w-0 items-center gap-2'>
              <PersonAvatar
                name={assignee.name}
                src={assignee.avatar}
                className='size-5!'
                fallbackClassName='text-[10px]'
              />
              <span className='truncate'>{assignee.name}</span>
            </span>
          ) : (
            <span className='text-muted-foreground'>Unassigned</span>
          )}
        </RecordField>

        <RecordField
          label='Body'
          icon={AlignLeftIcon}
          canEdit={canEdit}
          value={task.body ?? ''}
          placeholder='Add a body'
          onCommit={raw => updateTask(task.id, { body: raw || undefined })}
        />

        <RecordField type='static' label='Relations' icon={ArrowUpRightIcon}>
          <RecordTargetsField refs={refs} canEdit={canEdit} onChange={next => setTaskTargets(task.id, next)} />
        </RecordField>
      </RecordGroup>

      <RecordGroup title='System'>
        <RecordField type='static' label='Created' icon={CalendarIcon}>
          <span className='text-sm'>{formatDate(task.createdAt)}</span>
        </RecordField>
        <RecordField type='static' label='Created by' icon={UserPlusIcon}>
          <UserChip userId={task.createdById} />
        </RecordField>
      </RecordGroup>
    </div>
  )
}

export default TaskFields
