'use client'

import Link from 'next/link'
import { CalendarIcon, ClockIcon, FileTextIcon, CircleCheckIcon, UsersIcon, WalletIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/nexacrm/components/ui/tabs'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import UserChip from '@/features/nexacrm/components/record/user-chip'
import { useEmployeeOptions } from '@/features/hr/employee-options'
import { useTimeOffStore } from '../store'
import { APPROVAL_LABELS, PAYROLL_LABELS } from '../model'
import type { TimeOffRequest } from '../model'
import { formatAmount } from '../logic'
import TimeOffStatusBadge from '../components/status-badge'
import RequestBalance from './balance-summary'
import { decisionDateLabel, leaveDateLabel, requestPeriod } from './presentation'

export default function RequestContent({ record }: { record: TimeOffRequest }) {
  const { employees } = useEmployeeOptions()
  const employee = employees.find(employee => employee.id === record.employeeId)
  const type = useTimeOffStore(state => state.types.find(type => type.id === record.typeId))
  const allocations = useTimeOffStore(state => state.allocations)
  return (
    <Tabs defaultValue='details' className='gap-4'>
      <TabsList variant='line' className='w-full justify-start border-b'>
        <TabsTrigger value='details'>Details</TabsTrigger>
        <TabsTrigger value='history'>History · {record.history.length}</TabsTrigger>
      </TabsList>
      <TabsContent value='details' className='space-y-4'>
        <RecordGroup title='Time off request'>
          <RecordField type='static' label='Employee' icon={UsersIcon}>
            {employee ? (
              <Link href={`/employees/${employee.id}`} className='text-sm hover:underline'>
                {employee.name}
              </Link>
            ) : (
              <span className='text-muted-foreground text-sm'>Employee unavailable</span>
            )}
          </RecordField>
          <RecordField type='static' label='Time off type' icon={FileTextIcon}>
            {type ? (
              <Link href={`/time-off/types/${type.id}`} className='text-sm hover:underline'>
                {type.name}
              </Link>
            ) : (
              <span className='text-muted-foreground text-sm'>Type unavailable</span>
            )}
          </RecordField>
          <RecordField type='static' label='Dates' icon={CalendarIcon}>
            <span className='text-sm tabular-nums'>{requestPeriod(record)}</span>
          </RecordField>
          <RecordField type='static' label='Duration' icon={ClockIcon}>
            <span className='text-sm font-medium tabular-nums'>{formatAmount(record.duration, record.unit)}</span>
          </RecordField>
          <RecordField type='static' label='Status' icon={CircleCheckIcon}>
            <TimeOffStatusBadge status={record.status} />
          </RecordField>
          <RecordField type='static' label='Payroll treatment' icon={WalletIcon}>
            <span className='text-sm'>{type ? PAYROLL_LABELS[type.payroll] : 'Type unavailable'}</span>
          </RecordField>
          <RecordField type='static' label='Approval policy' icon={CircleCheckIcon}>
            <span className='text-sm'>{type ? APPROVAL_LABELS[type.approval] : 'Type unavailable'}</span>
          </RecordField>
        </RecordGroup>
        <RecordGroup title='Reason'>
          <p className='text-sm break-words whitespace-pre-wrap'>{record.reason || 'No reason provided.'}</p>
        </RecordGroup>
        <RequestBalance employeeId={record.employeeId} typeId={record.typeId} asOf={record.startDate} />
        <RecordGroup title='Allocation charges'>
          {record.consumptions.length > 0 ? (
            <div className='space-y-2'>
              {record.consumptions.map((charge, index) => {
                const allocation = allocations.find(allocation => allocation.id === charge.allocationId)
                return (
                  <div
                    key={`${charge.allocationId}-${charge.date}-${index}`}
                    className='flex flex-wrap items-start justify-between gap-2 border-b py-2 last:border-0'
                  >
                    <div className='min-w-0 space-y-0.5'>
                      <p className='text-xs'>{leaveDateLabel(charge.date)}</p>
                      <Link
                        href={`/time-off/allocations/${charge.allocationId}`}
                        className='text-primary text-xs hover:underline'
                      >
                        {allocation
                          ? `${leaveDateLabel(allocation.validFrom)} – ${allocation.validTo ? leaveDateLabel(allocation.validTo) : 'No expiry'} allocation`
                          : 'View allocation'}
                      </Link>
                    </div>
                    <span className='text-xs font-medium tabular-nums'>{formatAmount(charge.amount, record.unit)}</span>
                  </div>
                )
              })}
              <p className='text-muted-foreground text-xs'>
                {record.status === 'cancelled'
                  ? 'These historical charges were released when the leave was cancelled.'
                  : 'Approved leave consumes the allocations shown here. Cancelling the leave restores its charges.'}
              </p>
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {record.status === 'cancelled'
                ? 'Allocation charges were released when this request was cancelled.'
                : !type?.requiresAllocation
                  ? 'This leave type does not require an allocation.'
                  : 'No allocation charges yet. Only approval consumes the available balance.'}
            </p>
          )}
        </RecordGroup>
        <p className='text-muted-foreground text-xs'>
          Created {decisionDateLabel(record.createdAt)} · Updated {decisionDateLabel(record.updatedAt)}.
        </p>
      </TabsContent>
      <TabsContent value='history' className='space-y-3'>
        {record.history.length ? (
          [...record.history].reverse().map((decision, index) => (
            <div key={`${decision.at}-${index}`} className='space-y-2 rounded-lg border p-3'>
              <p className='text-sm font-medium capitalize'>{decision.action.replaceAll('_', ' ')}</p>
              {decision.reason && <p className='text-sm break-words whitespace-pre-wrap'>{decision.reason}</p>}
              <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
                {decisionDateLabel(decision.at)}
                <UserChip userId={decision.actorId} />
              </div>
            </div>
          ))
        ) : (
          <p className='text-muted-foreground py-4 text-sm'>No decisions recorded yet.</p>
        )}
      </TabsContent>
    </Tabs>
  )
}
