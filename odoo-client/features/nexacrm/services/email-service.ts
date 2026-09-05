import 'server-only'

import type { Email } from '@/features/nexacrm/types/apps/email-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'

// Business-data APIs are not connected yet. Never manufacture records as a fallback.
export const getEmails = async (): Promise<Email[]> => []

export const getEmailsForEntity: (entityType: EntityType, entityId: string) => Promise<Email[]> = async () => []
