import 'server-only'

import type { Attachment } from '@/features/nexacrm/types/apps/attachment-types'
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'

// Business-data APIs are not connected yet. Never manufacture records as a fallback.
export const getAttachments = async (): Promise<Attachment[]> => []

export const getAttachmentsForEntity: (
  entityType: ParentEntityType,
  entityId: string
) => Promise<Attachment[]> = async () => []
