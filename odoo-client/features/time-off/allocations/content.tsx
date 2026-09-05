'use client'

import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { ArrowUpRightIcon, CalendarDaysIcon, CircleCheckIcon, ClockIcon, UserIcon, WalletIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/features/nexacrm/components/ui/tabs'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'
import UserChip from '@/features/nexacrm/components/record/user-chip'
import { useEmployeeOptions } from '@/features/hr/employee-options'
import type { Allocation } from '../model'
import { useTimeOffStore } from '../store'
import { allocationBalance, formatAmount } from '../logic'
import TimeOffStatusBadge from '../components/status-badge'
import { AllocationDecisionControls } from './actions'

export const displayDate = (value: string) => (value ? format(parseISO(value), 'dd MMM yyyy') : 'No expiry')

export default function AllocationContent({ allocation }: { allocation: Allocation }) {
  const types = useTimeOffStore(state => state.types)
  const allocations = useTimeOffStore(state => state.allocations)
  const requests = useTimeOffStore(state => state.requests)
  const { employees } = useEmployeeOptions()
  const employee = employees.find(item => item.id === allocation.employeeId)
  const type = types.find(item => item.id === allocation.typeId)
  const balance = allocationBalance({ types, allocations, requests }, allocation.id)
  const unit = type?.unit ?? 'days'
  const linked = requests.filter(
    request => request.status === 'approved' && request.consumptions.some(item => item.allocationId === allocation.id)
  )
  const relatedHref = '/time-off/requests?employee=' + allocation.employeeId + '&type=' + allocation.typeId
  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-3'>
        <PersonAvatar name={employee ? employee.name : 'Employee'} className='size-9' />
        <div className='min-w-0 flex-1'>
          <h2 className='truncate text-base font-semibold'>
            {employee ? employee.name : 'Employee unavailable'}
          </h2>
          <p className='text-muted-foreground truncate text-sm'>
            {type?.name ?? 'Time off type unavailable'} · {formatAmount(allocation.amount, unit)}
          </p>
        </div>
      </div>
      <TimeOffStatusBadge status={allocation.status} />
      <AllocationDecisionControls allocation={allocation} />
      <Tabs defaultValue='overview' className='gap-4'>
        <TabsList variant='line' className='w-full justify-start border-b'>
          <TabsTrigger value='overview'>Overview</TabsTrigger>
          <TabsTrigger value='requests'>Taken · {linked.length}</TabsTrigger>
          <TabsTrigger value='history'>History · {allocation.history.length}</TabsTrigger>
        </TabsList>
        <TabsContent value='overview' className='space-y-4'>
          <RecordGroup title='Allocation balance'>
            <RecordField type='static' label='Granted' icon={WalletIcon}>
              <span className='text-sm tabular-nums'>{formatAmount(allocation.amount, unit)}</span>
            </RecordField>
            <RecordField type='static' label='Approved' icon={CircleCheckIcon}>
              <span className='text-sm tabular-nums'>{formatAmount(balance.allocated, unit)}</span>
            </RecordField>
            <RecordField type='static' label='Taken' icon={ClockIcon}>
              <span className='text-sm tabular-nums'>{formatAmount(balance.taken, unit)}</span>
            </RecordField>
            <RecordField type='static' label='Remaining' icon={WalletIcon}>
              <span className='text-sm font-medium tabular-nums'>{formatAmount(balance.remaining, unit)}</span>
            </RecordField>
          </RecordGroup>
          <p className='text-muted-foreground text-xs'>
            {allocation.status === 'approved'
              ? 'Remaining balance can only be used for leave inside this allocation’s validity period. Pending requests do not consume balance.'
              : 'This balance is unavailable until the allocation is approved.'}
          </p>
          <RecordGroup title='Validity & employee'>
            <RecordField type='static' label='Valid from' icon={CalendarDaysIcon}>
              <span className='text-sm'>{displayDate(allocation.validFrom)}</span>
            </RecordField>
            <RecordField type='static' label='Valid until' icon={CalendarDaysIcon}>
              <span className='text-sm'>{displayDate(allocation.validTo)}</span>
            </RecordField>
            <RecordField type='static' label='Employee' icon={UserIcon}>
              <Link className='truncate text-sm hover:underline' href={'/employees/' + allocation.employeeId}>
                {employee ? employee.name : 'View employee'}
              </Link>
            </RecordField>
            <RecordField type='static' label='Leave policy' icon={CalendarDaysIcon}>
              <Link className='truncate text-sm hover:underline' href={'/time-off/types/' + allocation.typeId}>
                {type?.name ?? 'View time off type'}
              </Link>
            </RecordField>
          </RecordGroup>
          <RecordGroup title='Notes'>
            <p className='text-muted-foreground py-2 text-sm break-words whitespace-pre-wrap'>
              {allocation.note || 'No notes added.'}
            </p>
          </RecordGroup>
          <Button variant='outline' className='w-full justify-between' render={<Link href={relatedHref} />}>
            <span>View employee requests</span>
            <ArrowUpRightIcon />
          </Button>
        </TabsContent>
        <TabsContent value='requests' className='space-y-3'>
          <p className='text-muted-foreground text-xs'>Approved requests that currently consume this allocation.</p>
          {linked.map(request => (
            <Link
              key={request.id}
              href={'/time-off/requests/' + request.id}
              className='hover:bg-muted/50 flex items-start justify-between gap-3 rounded-lg border p-3'
            >
              <div className='min-w-0 space-y-1'>
                <p className='text-sm font-medium'>
                  {displayDate(request.startDate)}
                  {request.endDate !== request.startDate ? ' – ' + displayDate(request.endDate) : ''}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {formatAmount(
                    request.consumptions
                      .filter(item => item.allocationId === allocation.id)
                      .reduce((sum, item) => sum + item.amount, 0),
                    unit
                  )}{' '}
                  from this allocation
                </p>
              </div>
              <ArrowUpRightIcon className='text-muted-foreground mt-0.5 size-4 shrink-0' />
            </Link>
          ))}
          {!linked.length && (
            <p className='text-muted-foreground py-5 text-center text-sm'>
              No leave has been taken from this allocation.
            </p>
          )}
          <Button variant='outline' size='sm' render={<Link href={relatedHref} />}>
            View all related requests
            <ArrowUpRightIcon />
          </Button>
        </TabsContent>
        <TabsContent value='history' className='space-y-3'>
          {[...allocation.history].reverse().map((item, index) => (
            <div key={item.at + '-' + index} className='space-y-2 rounded-lg border p-3'>
              <p className='text-sm font-medium capitalize'>{item.action.replaceAll('-', ' ')}</p>
              <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-xs'>
                {format(parseISO(item.at), 'dd MMM yyyy, HH:mm')}
                <UserChip userId={item.actorId} />
              </div>
              {item.reason && (
                <p className='text-muted-foreground mt-2 text-sm break-words whitespace-pre-wrap'>{item.reason}</p>
              )}
            </div>
          ))}
          {!allocation.history.length && <p className='text-muted-foreground text-sm'>No decisions recorded yet.</p>}
        </TabsContent>
      </Tabs>
    </div>
  )
}
