// Type Imports
import type { BadgeTone } from '@/features/nexacrm/lib/badge-tone'

export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const

export type TaskStatus = (typeof TASK_STATUSES)[number] | (string & {})

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done'
}

export const TASK_STATUS_TONES: Record<string, BadgeTone> = {
  todo: 'info',
  in_progress: 'purple',
  done: 'success'
}

export const NO_STATUS = 'none'

const humanize = (status: string) => status.replace(/[_-]+/g, ' ').replace(/^./, character => character.toUpperCase())

/** Display label for any status - seeded, custom, or unset. */
export const taskStatusLabel = (status?: TaskStatus): string =>
  status ? (TASK_STATUS_LABELS[status] ?? humanize(status)) : 'No status'

/** Badge tone for any status; a custom one is neutral until someone assigns it a meaning. */
export const taskStatusTone = (status?: TaskStatus): BadgeTone =>
  status ? (TASK_STATUS_TONES[status] ?? 'neutral') : 'neutral'

export const TASK_STATUS_OPTIONS = [
  { label: 'No status', value: NO_STATUS },
  ...TASK_STATUSES.map(status => ({ label: TASK_STATUS_LABELS[status], value: status }))
]

export type Task = {
  id: string
  title: string

  body?: string

  status?: TaskStatus

  dueAt?: string

  assigneeId?: string

  createdById?: string
  updatedById?: string
  createdAt: string
  updatedAt: string
}

export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt'>

export const buildBlankTaskInput = (assigneeId?: string): TaskInput => ({
  title: '',
  status: 'todo',
  assigneeId
})

/** Display name for a task whose title has not been filled in yet. */
export const taskDisplayName = (task: Pick<Task, 'title'>): string => task.title.trim() || 'Untitled'

export const isTaskDone = (status?: TaskStatus): boolean => status === 'done'

export const isTaskOverdue = (task: Pick<Task, 'status' | 'dueAt'>): boolean =>
  !!task.dueAt && task.status !== 'done' && task.dueAt < new Date().toISOString()

export const TASK_FIELD_LABELS: Partial<Record<keyof Task, string>> = {
  title: 'Title',
  body: 'Body',
  status: 'Status',
  dueAt: 'Due date',
  assigneeId: 'Assignee'
}
