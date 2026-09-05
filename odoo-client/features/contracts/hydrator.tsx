'use client'
import { useEffect } from 'react'
import { useContractsStore } from './store'
import type { Contract } from './types'

export default function ContractsHydrator({ data }: { data: Contract[] }) {
  const initialize = useContractsStore((state) => state.initialize)
  useEffect(() => initialize(data), [data, initialize])
  return null
}
