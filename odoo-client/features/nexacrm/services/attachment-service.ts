import 'server-only'

// Type Imports
import type { Attachment } from '@/features/nexacrm/types/apps/attachment-types'
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'

// Data Imports
import { db } from '@/features/nexacrm/fake-db/apps/attachments'

const toAttachment = ({ createdMinutesAgo, ...attachment }: (typeof db)[number]): Attachment => ({
  ...attachment,
  createdAt: new Date(Date.now() - createdMinutesAgo * 60_000).toISOString()
})

export const getAttachments = async (): Promise<Attachment[]> => {
  return db.map(toAttachment)
}

export const getAttachmentsForEntity = async (
  entityType: ParentEntityType,
  entityId: string
): Promise<Attachment[]> => {
  return db.filter(file => file.entityType === entityType && file.entityId === entityId).map(toAttachment)
}
