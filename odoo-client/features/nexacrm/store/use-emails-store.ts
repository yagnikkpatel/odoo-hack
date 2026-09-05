// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { Email, EmailInput } from '@/features/nexacrm/types/apps/email-types'
import type { EntityType } from '@/features/nexacrm/types/apps/record-ref'
import { matchesRef } from '@/features/nexacrm/types/apps/record-ref'

type EmailsData = {
  emails: Email[]
  hasHydrated: boolean
}

type EmailsActions = {
  initialize: (emails: Email[]) => void
  addEmail: (input: EmailInput) => string
}

export type EmailsStore = EmailsData & EmailsActions

export const useEmailsStore = create<EmailsStore>()(set => ({
  emails: [],
  hasHydrated: false,
  initialize: emails => set({ emails, hasHydrated: true }),

  addEmail: input => {
    const id = `eml_${crypto.randomUUID().slice(0, 8)}`

    set(state => ({ emails: [{ ...input, id, sentAt: new Date().toISOString() }, ...state.emails] }))

    return id
  }
}))

/** One email by id - the sheet resolves the opened message from the store (SSOT). */
export const useEmail = (id?: string): Email | undefined =>
  useEmailsStore(state => (id ? state.emails.find(email => email.id === id) : undefined))

export const useEntityEmails = (entityType: EntityType, entityId: string): Email[] => {
  const emails = useEmailsStore(state => state.emails)

  return useMemo(() => emails.filter(email => matchesRef(email, entityType, entityId)), [emails, entityType, entityId])
}
