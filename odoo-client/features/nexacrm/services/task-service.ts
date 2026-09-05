import 'server-only'

import type { Task } from '@/features/nexacrm/types/apps/task-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'
import type { TaskTarget } from '@/features/nexacrm/types/apps/record-target'

export type TasksData = { tasks: Task[]; taskTargets: TaskTarget[] }

// Business-data APIs are not connected yet. Never manufacture records as a fallback.
export const getTasksData = async (): Promise<TasksData> => ({ tasks: [], taskTargets: [] })

export const getTasksForEntity: (entityType: EntityType, entityId: string) => Promise<Task[]> = async () => []

export const getTaskById: (id: string) => Promise<Task | undefined> = async () => undefined
