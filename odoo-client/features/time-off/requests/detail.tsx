'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTimeOffStore } from '../store'
import TimeOffDetailPage from '../components/detail-page'
import RequestActions from './actions'
import RequestContent from './content'
import RequestEditor from './editor'
import { useTimeOffPermissions } from '../permissions'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

export default function RequestDetail({ requestId }: { requestId: string }) {
  const { user } = useCurrentUser()
  const { canReadAny } = useTimeOffPermissions()
  const record = useTimeOffStore(state => state.requests.find(request => request.id === requestId && (canReadAny || request.employeeId === user.id)))
  const hydrated = useTimeOffStore(state => state.hasHydrated)
  const error = useTimeOffStore(state => state.error)
  const [editing, setEditing] = useState(false)
  const router = useRouter()
  return (
    <TimeOffDetailPage
      title='Time off request'
      backHref='/time-off/requests'
      backLabel='Requests'
      loading={!hydrated}
      missing={hydrated && !record}
      error={error}
      actions={
        record && (
          <RequestActions
            record={record}
            detail
            onEdit={() => setEditing(true)}
            onDeleted={() => router.push('/time-off/requests')}
          />
        )
      }
    >
      {record && <RequestContent record={record} />}
      {record && editing && <RequestEditor record={record} onClose={() => setEditing(false)} onSaved={() => {}} />}
    </TimeOffDetailPage>
  )
}
