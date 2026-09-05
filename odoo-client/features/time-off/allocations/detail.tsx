'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/features/nexacrm/components/ui/button'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useTimeOffStore } from '../store'
import TimeOffDetailPage from '../components/detail-page'
import AllocationContent from './content'
import AllocationEditor from './editor'
import AllocationActions from './actions'

export default function AllocationDetail({ allocationId }: { allocationId: string }) {
  const allocation = useTimeOffStore(state => state.allocations.find(item => item.id === allocationId))
  const hydrated = useTimeOffStore(state => state.hasHydrated)
  const [editing, setEditing] = useState(false)
  const { can } = useCurrentUser()
  const router = useRouter()
  return (
    <TimeOffDetailPage
      title='Time off allocation'
      backHref='/time-off/allocations'
      backLabel='Allocations'
      loading={!hydrated}
      missing={hydrated && !allocation}
      actions={
        allocation ? (
          <>
            {can('records:update') && allocation.status !== 'approved' && (
              <Button variant='outline' size='sm' onClick={() => setEditing(true)}>
                {allocation.status === 'refused' ? 'Edit & resubmit' : 'Edit allocation'}
              </Button>
            )}
            <AllocationActions
              allocation={allocation}
              detail
              onEdit={() => setEditing(true)}
              onDeleted={() => router.push('/time-off/allocations')}
            />
          </>
        ) : undefined
      }
    >
      {allocation && <AllocationContent allocation={allocation} />}
      {editing && allocation && (
        <AllocationEditor allocation={allocation} onClose={() => setEditing(false)} onSaved={() => {}} />
      )}
    </TimeOffDetailPage>
  )
}
