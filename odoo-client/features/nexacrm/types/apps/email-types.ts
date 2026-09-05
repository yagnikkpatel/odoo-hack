// Type Imports
import type { RecordRef } from '@/features/nexacrm/types/apps/record-ref'

export const EMAIL_DIRECTIONS = ['inbound', 'outbound'] as const

export type EmailDirection = (typeof EMAIL_DIRECTIONS)[number]

export type Email = RecordRef & {
  id: string
  subject: string
  fromName: string
  fromEmail: string
  direction: EmailDirection
  snippet: string
  sentAt: string
  personId?: string

  /** Recipient - set on messages composed here; inbound mail is addressed to the workspace. */
  toEmail?: string

  cc?: string[]
  bcc?: string[]

  /** Full message text. `snippet` is the one-line preview the list shows. */
  body?: string
}

export type EmailInput = Omit<Email, 'id' | 'sentAt'>
