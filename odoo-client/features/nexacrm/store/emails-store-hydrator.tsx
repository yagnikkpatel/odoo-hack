'use client'

// React Imports
import { useEffect } from 'react'

// Type Imports
import type { Email } from '@/features/nexacrm/types/apps/email-types'

// Store Imports
import { useEmailsStore } from '@/features/nexacrm/store/use-emails-store'

const EmailsStoreHydrator = ({ data }: { data: Email[] }) => {
  useEffect(() => {
    useEmailsStore.getState().initialize(data)
  }, [data])

  return null
}

export default EmailsStoreHydrator
