// React Imports
import { useEffect } from 'react'

// Third-party Imports
import { create } from '@/features/nexacrm/adapters/native-store'

type BreadcrumbState = {
  recordLabel: string | null
  setRecordLabel: (label: string | null) => void
}

export const useBreadcrumbStore = create<BreadcrumbState>()(set => ({
  recordLabel: null,
  setRecordLabel: recordLabel => set({ recordLabel })
}))

export const useRecordBreadcrumb = (label?: string) => {
  useEffect(() => {
    useBreadcrumbStore.getState().setRecordLabel(label ?? null)

    return () => useBreadcrumbStore.getState().setRecordLabel(null)
  }, [label])
}
