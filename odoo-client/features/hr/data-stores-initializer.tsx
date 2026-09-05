'use client'

import { useEffect } from 'react'
import { useSchedulesStore } from '@/features/working-schedules/store'

/**
 * Resolve loading states without fabricating business records or schedules.
 *
 * Time off is no longer seeded here — it loads its own snapshot from the API on mount.
 * Keep this function synchronous: `useEffect` receives it directly and an effect callback
 * must not return a promise. Wrap it if it ever needs to await something.
 */
export function initializeEmptyDataStores() {
  useSchedulesStore.getState().initialize([], {})
}

export default function DataStoresInitializer() {
  useEffect(initializeEmptyDataStores, [])
  return null
}
