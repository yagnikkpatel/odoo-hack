import type { Metadata } from 'next'
import { Suspense } from 'react'
import TypesView from '@/features/time-off/types'

export const metadata: Metadata = { title: 'Time off types' }
export default function Page() {
  return (
    <Suspense
      fallback={
        <p role='status' className='py-8 text-sm'>
          Loading time off types…
        </p>
      }
    >
      <TypesView />
    </Suspense>
  )
}
