'use client'

import { useEffect } from 'react'
import { useEmployeesStore } from '@/features/employees/store'
import { useContractsStore } from '@/features/contracts/store'
import { useAttendanceStore } from '@/features/attendance/store'
import { useSchedulesStore } from '@/features/working-schedules/store'
import { useTimeOffStore } from '@/features/time-off/store'

/** Resolve loading states without fabricating business records or schedules. */
export function initializeEmptyDataStores() {
  useEmployeesStore.getState().initialize([])
  useContractsStore.getState().initialize([])
  useAttendanceStore.getState().initialize([])
  useSchedulesStore.getState().initialize([], {})
  useTimeOffStore.getState().initialize({ types: [], allocations: [], requests: [] })
}

export default function DataStoresInitializer() {
  useEffect(initializeEmptyDataStores, [])
  return null
}
