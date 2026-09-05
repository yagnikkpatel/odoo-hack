// Type Imports
import { NO_STATUS, TASK_STATUSES, TASK_STATUS_LABELS, TASK_STATUS_TONES } from '@/features/nexacrm/types/apps/task-types'

// Store Imports
import { createStagesStore } from '@/features/nexacrm/store/create-stages-store'

export const useTaskStagesStore = createStagesStore({
  stages: [NO_STATUS, ...TASK_STATUSES],
  labels: { ...TASK_STATUS_LABELS, [NO_STATUS]: 'No status' },
  tones: { ...TASK_STATUS_TONES, [NO_STATUS]: 'neutral' }
})
