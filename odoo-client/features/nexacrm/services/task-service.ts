import 'server-only'

// Type Imports
import type { TaskTarget } from '@/features/nexacrm/types/apps/record-target'
import { targetMatchesRef } from '@/features/nexacrm/types/apps/record-target'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'
import type { Task } from '@/features/nexacrm/types/apps/task-types'

// Data Imports
import { db, targetsDb } from '@/features/nexacrm/fake-db/apps/tasks'

const minutesToIso = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

const toTask = ({ createdMinutesAgo, dueInMinutes, ...task }: (typeof db)[number]): Task => ({
  ...task,
  dueAt: dueInMinutes === undefined ? undefined : minutesToIso(dueInMinutes),
  createdAt: minutesToIso(-createdMinutesAgo),
  updatedAt: minutesToIso(-createdMinutesAgo)
})

export type TasksData = { tasks: Task[]; taskTargets: TaskTarget[] }

export const getTasksData = async (): Promise<TasksData> => {
  return { tasks: db.map(toTask), taskTargets: targetsDb }
}

/** The tasks linked to one record, resolved THROUGH the join table. */
export const getTasksForEntity = async (entityType: EntityType, entityId: string): Promise<Task[]> => {
  const taskIds = new Set(
    targetsDb.filter(target => targetMatchesRef(target, entityType, entityId)).map(target => target.taskId)
  )

  return db.filter(task => taskIds.has(task.id)).map(toTask)
}

/** One task by id - the record route reads it on the server for the page title. */
export const getTaskById = async (id: string): Promise<Task | undefined> => {
  const seed = db.find(task => task.id === id)

  return seed && toTask(seed)
}
