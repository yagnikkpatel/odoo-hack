// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { RecordRef, EntityType } from '@/features/nexacrm/types/apps/record-ref'
import type { TaskTarget } from '@/features/nexacrm/types/apps/record-target'
import { refKey, targetColumns, targetMatchesRef, targetRefs } from '@/features/nexacrm/types/apps/record-target'
import type { Task, TaskInput, TaskStatus } from '@/features/nexacrm/types/apps/task-types'
import { TASK_FIELD_LABELS, TASK_STATUS_LABELS, taskDisplayName } from '@/features/nexacrm/types/apps/task-types'
import type { ActivityChange } from '@/features/nexacrm/types/apps/activity-types'

// Store Imports
import { useActivitiesStore } from '@/features/nexacrm/store/use-activities-store'
import { getActorId } from '@/features/nexacrm/store/use-current-actor-store'
import { useUsersStore } from '@/features/nexacrm/store/use-users-store'

// Util Imports
import { formatDate } from '@/features/nexacrm/utils/format'

const buildTask = (input: TaskInput): Task => {
  const now = new Date().toISOString()

  return {
    createdById: getActorId(),
    ...input,
    id: `task_${crypto.randomUUID().slice(0, 8)}`,
    createdAt: now,
    updatedAt: now
  }
}

/** Join rows for one task from a set of refs - de-duplicated, since a link twice is still one link. */
const buildTargets = (taskId: string, refs: RecordRef[]): TaskTarget[] => {
  const seen = new Set<string>()

  return refs.flatMap(ref => {
    if (seen.has(refKey(ref))) return []
    seen.add(refKey(ref))

    return [{ id: `tgt_${crypto.randomUUID().slice(0, 8)}`, taskId, ...targetColumns(ref) }]
  })
}

const formatChangeValue = (field: keyof Task, value: Task[keyof Task]): string | undefined => {
  if (value === undefined || value === null || value === '') return undefined

  if (field === 'status') return TASK_STATUS_LABELS[value as TaskStatus]
  if (field === 'dueAt') return formatDate(value as string)
  if (field === 'assigneeId') return useUsersStore.getState().users.find(user => user.id === value)?.name

  return String(value)
}

const logFieldChanges = (before: Task, input: Partial<Task>) => {
  const changes: ActivityChange[] = []

  for (const key of Object.keys(input) as (keyof Task)[]) {
    const label = TASK_FIELD_LABELS[key]

    if (!label || before[key] === input[key]) continue

    changes.push({ label, value: formatChangeValue(key, input[key]) })
  }

  if (changes.length === 0) return

  const title = 'title' in input && input.title ? input.title : taskDisplayName(before)

  useActivitiesStore.getState().addActivity({
    entityType: 'task',
    entityId: before.id,
    type: 'status',
    actorId: getActorId(),
    verb: `updated ${changes.length} ${changes.length === 1 ? 'field' : 'fields'} on`,
    subject: title,
    changes
  })
}

type TasksData = {
  tasks: Task[]

  /** The join table. One row = one (task → record) link, exactly one target column set. */
  taskTargets: TaskTarget[]
  hasHydrated: boolean
}

type TasksActions = {
  initialize: (data: { tasks: Task[]; taskTargets: TaskTarget[] }) => void

  /** Creates the task AND its join rows together, so a new task is never briefly unlinked. */
  addTask: (input: TaskInput, refs?: RecordRef[]) => string
  updateTask: (id: string, input: Partial<Omit<Task, 'id' | 'createdAt'>>) => void

  /** `undefined` clears the status - "No status" is a real state, not a missing value. */
  setTaskStatus: (id: string, status?: TaskStatus) => void

  /** Replaces a task's whole target set - what the Relations picker commits. */
  setTaskTargets: (taskId: string, refs: RecordRef[]) => void
  deleteTask: (id: string) => void
  deleteTasks: (ids: string[]) => void
}

export type TasksStore = TasksData & TasksActions

export const useTasksStore = create<TasksStore>()((set, get) => ({
  tasks: [],
  taskTargets: [],
  hasHydrated: false,

  initialize: ({ tasks, taskTargets }) => set({ tasks, taskTargets, hasHydrated: true }),

  addTask: (input, refs = []) => {
    const task = buildTask(input)

    set(state => ({
      tasks: [task, ...state.tasks],
      taskTargets: [...state.taskTargets, ...buildTargets(task.id, refs)]
    }))

    return task.id
  },

  updateTask: (id, input) => {
    const before = get().tasks.find(task => task.id === id)

    set(state => ({
      tasks: state.tasks.map(task =>
        task.id === id ? { ...task, ...input, updatedById: getActorId(), updatedAt: new Date().toISOString() } : task
      )
    }))

    if (before) logFieldChanges(before, input)
  },

  setTaskStatus: (id, status) => {
    const before = get().tasks.find(task => task.id === id)

    set(state => ({
      tasks: state.tasks.map(task =>
        task.id === id ? { ...task, status, updatedById: getActorId(), updatedAt: new Date().toISOString() } : task
      )
    }))

    if (before) logFieldChanges(before, { status })
  },

  setTaskTargets: (taskId, refs) =>
    set(state => ({
      taskTargets: [...state.taskTargets.filter(target => target.taskId !== taskId), ...buildTargets(taskId, refs)],
      tasks: state.tasks.map(task => (task.id === taskId ? { ...task, updatedAt: new Date().toISOString() } : task))
    })),

  deleteTask: id =>
    set(state => ({
      tasks: state.tasks.filter(task => task.id !== id),
      taskTargets: state.taskTargets.filter(target => target.taskId !== id)
    })),

  deleteTasks: ids =>
    set(state => ({
      tasks: state.tasks.filter(task => !ids.includes(task.id)),
      taskTargets: state.taskTargets.filter(target => !ids.includes(target.taskId))
    }))
}))

/** One task by id - the sheet and the record page both resolve their subject from the store (SSOT). */
export const useTask = (id?: string): Task | undefined =>
  useTasksStore(state => (id ? state.tasks.find(task => task.id === id) : undefined))

/** The records a task concerns, in join-row order. */
export const useTaskRefs = (taskId?: string): RecordRef[] => {
  const taskTargets = useTasksStore(state => state.taskTargets)

  return useMemo(
    () => (taskId ? targetRefs(taskTargets.filter(target => target.taskId === taskId)) : []),
    [taskTargets, taskId]
  )
}

export const useEntityTasks = (entityType: EntityType, entityId: string): Task[] => {
  const tasks = useTasksStore(state => state.tasks)
  const taskTargets = useTasksStore(state => state.taskTargets)

  return useMemo(() => {
    const taskIds = new Set(
      taskTargets.filter(target => targetMatchesRef(target, entityType, entityId)).map(target => target.taskId)
    )

    return tasks.filter(task => taskIds.has(task.id))
  }, [tasks, taskTargets, entityType, entityId])
}

export const useTaskNavigation = (id: string) => {
  const tasks = useTasksStore(state => state.tasks)

  return useMemo(() => {
    const index = tasks.findIndex(task => task.id === id)

    return {
      index,
      total: tasks.length,
      previousId: index > 0 ? tasks[index - 1].id : undefined,
      nextId: index >= 0 && index < tasks.length - 1 ? tasks[index + 1].id : undefined
    }
  }, [tasks, id])
}
