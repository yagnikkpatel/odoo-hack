import 'server-only'

// Type Imports
import type { Activity } from '@/features/nexacrm/types/apps/activity-types'
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'

// Data Imports
import { db } from '@/features/nexacrm/fake-db/apps/activities'

const toActivity = ({ minutesAgo, ...activity }: (typeof db)[number]): Activity => ({
  ...activity,
  occurredAt: new Date(Date.now() - minutesAgo * 60_000).toISOString()
})

const byNewestFirst = (a: Activity, b: Activity) => b.occurredAt.localeCompare(a.occurredAt)

export const getActivities = async (): Promise<Activity[]> => {
  return db.map(toActivity).sort(byNewestFirst)
}

export const getActivitiesForEntity = async (entityType: ParentEntityType, entityId: string): Promise<Activity[]> => {
  return db
    .filter(activity => activity.entityType === entityType && activity.entityId === entityId)
    .map(toActivity)
    .sort(byNewestFirst)
}
