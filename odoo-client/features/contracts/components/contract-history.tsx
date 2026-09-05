'use client'
import Link from 'next/link'
import { FileTextIcon, ArrowUpRightIcon } from 'lucide-react'
import { RecordHeading } from '@/features/nexacrm/components/record/record-section'
import { cn } from '@/features/nexacrm/lib/utils'
import { useContractsStore } from '../store'
import { contractStatus, formatContractDate, formatWage } from '../types'
import type { Contract } from '../types'
import ContractStatusBadge from './status-badge'

export default function ContractHistory({ contract }: { contract: Contract }) {
  const contracts = useContractsStore((state) => state.contracts)
  const history = contracts
    .filter((item) => item.employeeId === contract.employeeId)
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  return (
    <section className="space-y-4">
      <RecordHeading title="Employee contract history" count={history.length} />
      <p className="text-muted-foreground text-sm">
        All agreements for this employee, newest first. Previous terms remain
        available for their applicable periods.
      </p>
      <ul className="space-y-3">
        {history.map((item) => (
          <li key={item.id}>
            <Link
              href={'/contracts/' + item.id}
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
                    {item.name}
                  </span>
                  <ContractStatusBadge status={contractStatus(item)} />
                </div>
                <p className="text-muted-foreground text-xs">
                  {formatContractDate(item.startDate)} –{' '}
                  {formatContractDate(item.endDate)}
                </p>
                <p className="text-sm tabular-nums">{formatWage(item)}</p>
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
    </section>
  )
}
