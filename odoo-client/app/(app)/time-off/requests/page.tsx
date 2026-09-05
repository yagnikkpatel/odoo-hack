import type { Metadata } from 'next'
import { Suspense } from 'react'
import RequestsView from '@/features/time-off/requests'

export const metadata: Metadata = { title: 'Time off requests' }
export default function Page() {
  return (
    <Suspense
      fallback={
        <p role='status' className='py-8 text-sm'>
          Loading time off requests…
        </p>
      }
    >
      <RequestsView />
    </Suspense>
  )
}
