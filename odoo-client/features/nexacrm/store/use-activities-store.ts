// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { Activity, ActivityInput } from '@/features/nexacrm/types/apps/activity-types'
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'
import { matchesRef } from '@/features/nexacrm/types/apps/record-ref'

const buildActivity = (input: ActivityInput): Activity => ({
  ...input,
  id: `act_${crypto.randomUUID().slice(0, 8)}`,
  occurredAt: input.occurredAt ?? new Date().toISOString()
})

type ActivitiesData = {
  activities: Activity[]
  hasHydrated: boolean
}

type ActivitiesActions = {
  initialize: (activities: Activity[]) => void
  addActivity: (input: ActivityInput) => string
  deleteActivity: (id: string) => void
}

export type ActivitiesStore = ActivitiesData & ActivitiesActions

export const useActivitiesStore = create<ActivitiesStore>()(set => ({
  activities: [],
  hasHydrated: false,

  initialize: activities => set({ activities, hasHydrated: true }),

  addActivity: input => {
    const activity = buildActivity(input)

    set(state => ({ activities: [activity, ...state.activities] }))

    return activity.id
  },

  deleteActivity: id => set(state => ({ activities: state.activities.filter(activity => activity.id !== id) }))
}))

export const useEntityActivities = (entityType: ParentEntityType, entityId: string): Activity[] => {
  const activities = useActivitiesStore(state => state.activities)

  return useMemo(
    () => activities.filter(activity => matchesRef(activity, entityType, entityId)),
    [activities, entityType, entityId]
  )
}
