'use client'

import Link from 'next/link'
import { CalendarIcon, CalendarPlusIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { useTimeOffStore } from '../store'

export default function EmployeeTimeOffLinks({ employeeId }: { employeeId: string }) {
  const requests = useTimeOffStore(state => state.requests.filter(record => record.employeeId === employeeId).length)
  const allocations = useTimeOffStore(
    state => state.allocations.filter(record => record.employeeId === employeeId).length
  )
  return (
    <>
      <Button
        variant='outline'
        size='sm'
        className='justify-start'
        render={<Link href={'/time-off/requests?employee=' + encodeURIComponent(employeeId)} />}
      >
        <CalendarIcon />
        <span>Time off</span>
        <span className='ml-auto text-xs tabular-nums'>{requests}</span>
      </Button>
      <Button
        variant='outline'
        size='sm'
        className='justify-start'
        render={<Link href={'/time-off/allocations?employee=' + encodeURIComponent(employeeId)} />}
      >
        <CalendarPlusIcon />
        <span>Allocations</span>
        <span className='ml-auto text-xs tabular-nums'>{allocations}</span>
      </Button>
    </>
  )
}
