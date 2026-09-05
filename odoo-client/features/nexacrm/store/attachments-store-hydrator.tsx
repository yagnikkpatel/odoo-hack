'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { Attachment } from '@/features/nexacrm/types/apps/attachment-types'

// Store Imports
import { useAttachmentsStore } from '@/features/nexacrm/store/use-attachments-store'

const AttachmentsStoreHydrator = ({ data }: { data: Attachment[] }) => {
  useEffect(() => {
    useAttachmentsStore.getState().initialize(data)
  }, [data])

  return null
}

export default AttachmentsStoreHydrator
