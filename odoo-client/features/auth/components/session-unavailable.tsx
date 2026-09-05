'use client'

import { Button } from '@/components/ui/button'

export function SessionUnavailable() {
  return (
    <main className='bg-background grid min-h-svh place-items-center p-6'>
      <div className='max-w-md space-y-4 rounded-xl border p-6'>
        <h1 className='text-lg font-semibold'>Unable to verify your session</h1>
        <p className='text-muted-foreground text-sm' role='status'>
          The authentication service is unavailable. Your session has not been cleared. Try again when the connection is
          restored.
        </p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    </main>
  )
}
