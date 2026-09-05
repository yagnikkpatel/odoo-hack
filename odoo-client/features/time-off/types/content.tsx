'use client'

import Link from 'next/link'
import { ArrowUpRightIcon, CalendarDaysIcon, ShieldCheckIcon, WalletIcon } from 'lucide-react'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Button } from '@/features/nexacrm/components/ui/button'
import RecordField from '@/features/nexacrm/components/record/record-field'
import { RecordGroup } from '@/features/nexacrm/components/record/record-section'
import { APPROVAL_LABELS, PAYROLL_LABELS, UNIT_LABELS } from '../model'
import type { TimeOffType } from '../model'
import { useTimeOffStore } from '../store'

export default function TypeContent({ type }: { type: TimeOffType }) {
  const allocations = useTimeOffStore(state => state.allocations)
  const requests = useTimeOffStore(state => state.requests)
  return (
    <div className='space-y-5'>
      <div className='space-y-2'>
        <h2 className='text-base font-semibold break-words'>{type.name}</h2>
        <div className='flex flex-wrap gap-2'>
          <Badge variant='outline'>{type.code}</Badge>
          <Badge variant={type.active ? 'secondary' : 'outline'}>{type.active ? 'Active' : 'Archived'}</Badge>
        </div>
      </div>
      <RecordGroup title='Leave policy'>
        <RecordField type='static' label='Unit' icon={CalendarDaysIcon}>
          <span className='text-sm'>{UNIT_LABELS[type.unit]}</span>
        </RecordField>
        <RecordField type='static' label='Allocation' icon={WalletIcon}>
          <span className='text-sm'>{type.requiresAllocation ? 'Approved balance required' : 'Not required'}</span>
        </RecordField>
        <RecordField type='static' label='Approval' icon={ShieldCheckIcon}>
          <span className='text-sm'>{APPROVAL_LABELS[type.approval]}</span>
        </RecordField>
        <RecordField type='static' label='Payroll' icon={WalletIcon}>
          <span className='text-sm'>{PAYROLL_LABELS[type.payroll]}</span>
        </RecordField>
      </RecordGroup>
      <RecordGroup title='Policy notes'>
        <p className='text-muted-foreground py-2 text-sm break-words whitespace-pre-wrap'>
          {type.description || 'No policy notes added.'}
        </p>
      </RecordGroup>
      <RecordGroup title='Related records'>
        <div className='grid gap-2 pt-2'>
          <Button
            variant='outline'
            className='justify-between'
            render={<Link href={'/time-off/allocations?type=' + type.id} />}
          >
            <span>Allocations · {allocations.filter(item => item.typeId === type.id).length}</span>
            <ArrowUpRightIcon />
          </Button>
          <Button
            variant='outline'
            className='justify-between'
            render={<Link href={'/time-off/requests?type=' + type.id} />}
          >
            <span>Requests · {requests.filter(item => item.typeId === type.id).length}</span>
            <ArrowUpRightIcon />
          </Button>
        </div>
      </RecordGroup>
      <p className='text-muted-foreground text-xs'>
        Approved requests consume matching, valid allocations. Payroll treatment is configuration for the future payroll
        integration.
      </p>
    </div>
  )
}
