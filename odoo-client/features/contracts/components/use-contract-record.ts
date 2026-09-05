'use client'

import { useEffect, useState } from 'react'
import { useContract, useContractsStore } from '../store'

export function useContractRecord(id: string | null) {
  const contract = useContract(id || undefined)
  const loadContract = useContractsStore((state) => state.loadContract)
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(
    null,
  )

  useEffect(() => {
    if (!id || contract) return
    let active = true
    void loadContract(id)
      .catch((cause) => {
        if (!active) return
        setFailure({
          id,
          message:
            cause instanceof Error
              ? cause.message
              : 'The contract could not be loaded.',
        })
      })
    return () => {
      active = false
    }
  }, [contract, id, loadContract])

  const error = failure?.id === id ? failure.message : null
  return { contract, loading: Boolean(id && !contract && !error), error }
}
