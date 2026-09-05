// Type Imports
import { NOTE_STATUSES, NOTE_STATUS_LABELS, NOTE_STATUS_TONES, NO_NOTE_STATUS } from '@/features/nexacrm/types/apps/note-types'

// Store Imports
import { createStagesStore } from '@/features/nexacrm/store/create-stages-store'

export const useNoteStagesStore = createStagesStore({
  stages: [NO_NOTE_STATUS, ...NOTE_STATUSES],
  labels: { ...NOTE_STATUS_LABELS, [NO_NOTE_STATUS]: 'No status' },
  tones: { ...NOTE_STATUS_TONES, [NO_NOTE_STATUS]: 'neutral' }
})
