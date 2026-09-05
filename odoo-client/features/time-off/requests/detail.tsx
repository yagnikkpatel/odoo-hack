'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTimeOffStore } from '../store'
import TimeOffDetailPage from '../components/detail-page'
import RequestActions from './actions'
import RequestContent from './content'
import RequestEditor from './editor'

export default function RequestDetail({ requestId }: { requestId: string }) {
  const record = useTimeOffStore(state => state.requests.find(request => request.id === requestId))
  const hydrated = useTimeOffStore(state => state.hasHydrated)
  const [editing, setEditing] = useState(false)
  const router = useRouter()
  return (
    <TimeOffDetailPage
      title='Time off request'
      backHref='/time-off/requests'
      backLabel='Requests'
      loading={!hydrated}
      missing={hydrated && !record}
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
