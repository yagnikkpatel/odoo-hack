'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/features/nexacrm/components/ui/button'
import { useTimeOffPermissions } from '../permissions'
import { useTimeOffStore } from '../store'
import TimeOffDetailPage from '../components/detail-page'
import TypeContent from './content'
import TypeEditor from './editor'
import TypeActions from './actions'

export default function TypeDetail({ typeId }: { typeId: string }) {
  const type = useTimeOffStore(state => state.types.find(item => item.id === typeId))
  const hydrated = useTimeOffStore(state => state.hasHydrated)
  const error = useTimeOffStore(state => state.error)
  const [editing, setEditing] = useState(false)
  const { canManageTypes } = useTimeOffPermissions()
  const router = useRouter()
  return (
    <TimeOffDetailPage
      title={type?.name ?? 'Time off type'}
      backHref='/time-off/types'
      backLabel='Time off types'
      loading={!hydrated}
      missing={hydrated && !type}
      error={error}
      actions={
        type ? (
          <>
            {canManageTypes && (
              <Button variant='outline' size='sm' onClick={() => setEditing(true)}>
                Edit type
              </Button>
            )}
            <TypeActions
              type={type}
              detail
              onEdit={() => setEditing(true)}
              onDeleted={() => router.push('/time-off/types')}
            />
          </>
        ) : undefined
      }
    >
      {type && <TypeContent type={type} />}
      {editing && type && <TypeEditor type={type} onClose={() => setEditing(false)} onSaved={() => {}} />}
    </TimeOffDetailPage>
  )
}
