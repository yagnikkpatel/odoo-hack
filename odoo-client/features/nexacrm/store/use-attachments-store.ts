// React Imports
import { useMemo } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

// Type Imports
import type { Attachment, AttachmentInput } from '@/features/nexacrm/types/apps/attachment-types'
import type { ParentEntityType } from '@/features/nexacrm/types/apps/record-ref'
import { matchesRef } from '@/features/nexacrm/types/apps/record-ref'

const buildAttachment = (input: AttachmentInput): Attachment => ({
  ...input,
  id: `file_${crypto.randomUUID().slice(0, 8)}`,
  createdAt: new Date().toISOString()
})

type AttachmentsData = {
  attachments: Attachment[]
  hasHydrated: boolean
}

type AttachmentsActions = {
  initialize: (attachments: Attachment[]) => void
  addAttachment: (input: AttachmentInput) => string
  deleteAttachment: (id: string) => void
}

export type AttachmentsStore = AttachmentsData & AttachmentsActions

export const useAttachmentsStore = create<AttachmentsStore>()(set => ({
  attachments: [],
  hasHydrated: false,

  initialize: attachments => set({ attachments, hasHydrated: true }),

  addAttachment: input => {
    const attachment = buildAttachment(input)

    set(state => ({ attachments: [attachment, ...state.attachments] }))

    return attachment.id
  },

  deleteAttachment: id => set(state => ({ attachments: state.attachments.filter(file => file.id !== id) }))
}))

export const useEntityAttachments = (entityType: ParentEntityType, entityId: string): Attachment[] => {
  const attachments = useAttachmentsStore(state => state.attachments)

  return useMemo(
    () => attachments.filter(file => matchesRef(file, entityType, entityId)),
    [attachments, entityType, entityId]
  )
}
