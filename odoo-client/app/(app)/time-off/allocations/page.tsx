import type { Metadata } from 'next'
import { Suspense } from 'react'
import AllocationsView from '@/features/time-off/allocations'

export const metadata: Metadata = { title: 'Allocations' }
export default function Page() {
  return (
    <Suspense
      fallback={
        <p role='status' className='py-8 text-sm'>
          Loading allocations…
        </p>
      }
    >
      <AllocationsView />
    </Suspense>
  )
}
