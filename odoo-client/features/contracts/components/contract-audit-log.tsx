'use client'

import { useEffect, useState } from 'react'
import {
  HistoryIcon,
  LoaderCircleIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'
import { getContractAuditLog } from '../service'
import {
  CONTRACT_HISTORY_FIELD_LABELS,
  formatContractHistoryValue,
  formatContractTimestamp,
} from '../types'
import type { Contract, ContractHistoryEntry } from '../types'

const ACTION_LABEL: Record<ContractHistoryEntry['action'], string> = {
  created: 'Contract created',
  updated: 'Contract updated',
  deleted: 'Contract deleted',
}

const ACTION_ICON: Record<ContractHistoryEntry['action'], typeof PlusIcon> = {
  created: PlusIcon,
  updated: PencilIcon,
  deleted: Trash2Icon,
}

export default function ContractAuditLog({ contract }: { contract: Contract }) {
  // A saved edit updates the record without navigating away. Reload its log,
  // including loading/error state, and discard any request for the old version.
  return <ContractAuditEntries key={`${contract.id}:${contract.updatedAt}`} contract={contract} />
}

function ContractAuditEntries({ contract }: { contract: Contract }) {
  const [entries, setEntries] = useState<ContractHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    void getContractAuditLog(contract.id)
      .then(setEntries)
      .catch((cause) => {
        setError(
          cause instanceof Error
            ? cause.message
            : 'Contract audit log could not be loaded.',
        )
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    let active = true
    void getContractAuditLog(contract.id)
      .then((records) => {
        if (active) setEntries(records)
      })
      .catch((cause) => {
        if (!active) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Contract audit log could not be loaded.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [contract.id])

  return (
    <section className="space-y-4">
      <RecordHeading title="Edit history" count={entries.length} />
      <p className="text-muted-foreground text-sm">
        Every create, update, and delete recorded for this contract, newest
        first.
      </p>
      {loading && (
        <p role="status" className="text-muted-foreground flex gap-2 text-sm">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Loading edit history…
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
      {!error && !loading && entries.length === 0 && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <HistoryIcon className="size-4" />
          No edits recorded yet.
        </p>
      )}
      {!error && entries.length > 0 && (
        <ul className="space-y-3">
          {entries.map((entry) => {
            const Icon = ACTION_ICON[entry.action]
            const fields = Object.entries(entry.changes)
            return (
              <li key={entry.id} className="flex gap-3 rounded-lg border p-3">
                <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {ACTION_LABEL[entry.action]}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {formatContractTimestamp(entry.createdAt)}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    By {entry.changedByName ?? 'Unknown user'}
                  </p>
                  {fields.length > 0 && (
                    <ul className="space-y-1 pt-1">
                      {fields.map(([field, change]) => (
                        <li key={field} className="text-sm">
                          <span className="text-muted-foreground">
                            {CONTRACT_HISTORY_FIELD_LABELS[field] ?? field}:
                          </span>{' '}
                          <span className="line-through opacity-60">
                            {formatContractHistoryValue(field, change.old)}
                          </span>{' '}
                          <span aria-hidden>→</span>{' '}
                          <span>
                            {formatContractHistoryValue(field, change.new)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
