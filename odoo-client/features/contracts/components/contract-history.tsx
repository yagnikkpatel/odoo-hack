'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRightIcon,
  FileTextIcon,
  LoaderCircleIcon,
  RefreshCwIcon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'
import { cn } from '@/features/nexacrm/lib/utils'
import { listEmployeeContracts } from '../service'
import { formatContractDate, formatWage } from '../types'
import type { Contract } from '../types'
import ContractStatusBadge from './status-badge'

export default function ContractHistory({ contract }: { contract: Contract }) {
  return <EmployeeContracts key={`${contract.id}:${contract.updatedAt}`} contract={contract} />
}

function EmployeeContracts({ contract }: { contract: Contract }) {
  const [history, setHistory] = useState<Contract[]>([contract])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    void listEmployeeContracts(contract.employeeId)
      .then(setHistory)
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Contract history could not be loaded.',
        )
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let active = true
    void listEmployeeContracts(contract.employeeId)
      .then((records) => {
        if (active) setHistory(records)
      })
      .catch((cause) => {
        if (!active) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Contract history could not be loaded.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [contract.employeeId])

  return (
    <section className="space-y-4">
      <RecordHeading title="Employee contracts" count={history.length} />
      <p className="text-muted-foreground text-sm">
        Contracts held by this employee, newest first.
      </p>
      {loading && (
        <p role="status" className="text-muted-foreground flex gap-2 text-sm">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Loading contract history…
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="border-destructive/20 bg-destructive/5 space-y-3 rounded-lg border p-3"
        >
          <p className="text-destructive text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCwIcon /> Retry
          </Button>
        </div>
      )}
      {!error && (
        <ul className="space-y-3">
          {history.map((item) => (
            <li key={item.id}>
              <Link
                href={`/contracts/${item.id}`}
                aria-current={item.id === contract.id ? 'page' : undefined}
                className={cn(
                  'hover:bg-accent flex gap-3 rounded-lg border p-3 transition-colors',
                  item.id === contract.id && 'bg-muted/30',
                )}
              >
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <FileTextIcon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium break-words">
                      {item.employeeName}
                    </span>
                    <ContractStatusBadge status={item.status} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatContractDate(item.startDate)} –{' '}
                    {formatContractDate(item.endDate)}
                  </p>
                  <p className="text-sm tabular-nums">
                    Wage {formatWage(item.wage)}
                  </p>
                </div>
                {item.id === contract.id ? (
                  <span className="text-muted-foreground self-start text-xs">
                    Viewing
                  </span>
                ) : (
                  <ArrowUpRightIcon className="text-muted-foreground size-4 shrink-0" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
