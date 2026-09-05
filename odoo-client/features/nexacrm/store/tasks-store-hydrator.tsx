'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { TaskTarget } from '@/features/nexacrm/types/apps/record-target'
import type { Task } from '@/features/nexacrm/types/apps/task-types'

// Store Imports
import { useTasksStore } from '@/features/nexacrm/store/use-tasks-store'

const TasksStoreHydrator = ({ data }: { data: { tasks: Task[]; taskTargets: TaskTarget[] } }) => {
  useEffect(() => {
    useTasksStore.getState().initialize(data)
  }, [data])

  return null
}

export default TasksStoreHydrator
