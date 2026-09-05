'use client'

import Link from 'next/link'
import { useTimeOffStore } from '../store'
import { employeeBalance, formatAmount, localDate } from '../logic'
import { leaveDateLabel } from './presentation'

export default function RequestBalance({
  employeeId,
  typeId,
  asOf
}: {
  employeeId: string
  typeId: string
  asOf: string
}) {
  const state = useTimeOffStore()
  const type = state.types.find(item => item.id === typeId)
  if (!type || !employeeId) return null
  const balance = employeeBalance(state, employeeId, typeId, asOf || undefined)
  const allocations = state.allocations.filter(
    allocation =>
      allocation.employeeId === employeeId && allocation.typeId === typeId && allocation.status === 'approved'
  )
  if (!type.requiresAllocation)
    return (
      <div className='bg-muted/40 space-y-1 rounded-lg border p-3 text-xs'>
        <p className='font-medium'>No allocation required</p>
        <p className='text-muted-foreground'>
          This leave type does not deduct an allocated balance. Approved usage is still tracked:{' '}
          {formatAmount(balance.taken, type.unit)}.
        </p>
      </div>
    )
  return (
    <div className='space-y-3 rounded-lg border p-3'>
      <div className='flex flex-wrap items-center justify-between gap-1'>
        <p className='text-xs font-medium'>Balance at {asOf ? leaveDateLabel(asOf) : 'today'}</p>
        <Link
          href={`/time-off/allocations?employee=${encodeURIComponent(employeeId)}&type=${encodeURIComponent(typeId)}`}
          className='text-primary text-xs hover:underline'
        >
          View allocations
        </Link>
      </div>
      <dl className='grid grid-cols-3 gap-2'>
        {(
          [
            ['Allocated', balance.allocated],
            ['Taken', balance.taken],
            ['Remaining', balance.remaining]
          ] as const
        ).map(([label, amount]) => (
          <div key={label} className='min-w-0'>
            <dt className='text-muted-foreground text-xs'>{label}</dt>
            <dd className='mt-1 text-sm font-medium tabular-nums'>{formatAmount(amount, type.unit)}</dd>
          </div>
        ))}
      </dl>
      <div className='max-h-36 space-y-1 overflow-y-auto text-xs'>
        {allocations.length > 0 && (
          <p className='text-muted-foreground mb-1.5 font-medium'>Approved allocation validity</p>
        )}
        {allocations.length ? (
          allocations.map(allocation => (
            <Link
              key={allocation.id}
              href={`/time-off/allocations/${allocation.id}`}
              className='text-muted-foreground hover:text-foreground flex flex-wrap justify-between gap-1 hover:underline'
            >
              <span>
                {leaveDateLabel(allocation.validFrom)} –{' '}
                {allocation.validTo ? leaveDateLabel(allocation.validTo) : 'No expiry'}
              </span>
              <span className='tabular-nums'>
                {formatAmount(allocation.amount, type.unit)} ·{' '}
                {allocation.validFrom > (asOf || localDate())
                  ? 'Not yet valid'
                  : allocation.validTo && allocation.validTo < (asOf || localDate())
                    ? 'Expired'
                    : 'Applicable'}
              </span>
            </Link>
          ))
        ) : (
          <p className='text-muted-foreground'>No approved allocations for this employee and leave type.</p>
        )}
      </div>
    </div>
  )
}
