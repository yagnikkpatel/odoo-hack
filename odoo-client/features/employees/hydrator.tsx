'use client'
import { useEffect } from 'react'
import type { Employee } from './types'
import { useEmployeesStore } from './store'

export default function EmployeesHydrator({ data }: { data: Employee[] }) {
  useEffect(() => {
    useEmployeesStore.getState().initialize(data)
  }, [data])
  return null
}
