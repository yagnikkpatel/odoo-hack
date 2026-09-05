import 'server-only'

import type { Activity } from '@/features/nexacrm/types/apps/activity-types'
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'

// Business-data APIs are not connected yet. Never manufacture records as a fallback.
export const getActivities = async (): Promise<Activity[]> => []

export const getActivitiesForEntity: (
  entityType: ParentEntityType,
  entityId: string
) => Promise<Activity[]> = async () => []
