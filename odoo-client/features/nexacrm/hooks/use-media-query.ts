'use client'

// React Imports
import { useCallback, useSyncExternalStore } from 'react'

export const useMediaQuery = (query: string, defaultValue = true): boolean => {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mql = window.matchMedia(query)

      mql.addEventListener('change', onStoreChange)

      return () => mql.removeEventListener('change', onStoreChange)
    },
    [query]
  )

  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query])
  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue])

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
