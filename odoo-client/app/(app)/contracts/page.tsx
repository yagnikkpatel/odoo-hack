import type { Metadata } from 'next'
import { Suspense } from 'react'
import ContractsView from '@/features/contracts'

export const metadata: Metadata = {
  title: 'Contracts',
  description: 'Employee contracts and employment history.',
}
export default function ContractsPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="text-muted-foreground py-8 text-sm">
          Loading contracts…
        </div>
      }
    >
      <ContractsView />
    </Suspense>
  )
}
