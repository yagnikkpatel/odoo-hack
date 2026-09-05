import 'server-only'

// Type Imports
import type { Email } from '@/features/nexacrm/types/apps/email-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'

// Data Imports
import { db } from '@/features/nexacrm/fake-db/apps/emails'

const toEmail = ({ sentMinutesAgo, ...email }: (typeof db)[number]): Email => ({
  ...email,
  sentAt: new Date(Date.now() - sentMinutesAgo * 60_000).toISOString()
})

export const getEmails = async (): Promise<Email[]> => {
  return db.map(toEmail)
}

export const getEmailsForEntity = async (entityType: EntityType, entityId: string): Promise<Email[]> => {
  return db.filter(email => email.entityType === entityType && email.entityId === entityId).map(toEmail)
}
