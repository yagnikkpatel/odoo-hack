import { ShieldOffIcon } from 'lucide-react'

/**
 * Shown when an account reaches a page its role does not cover. Navigation
 * already hides these links; this catches a typed or bookmarked URL, and the
 * API refuses the underlying request either way.
 */
export function AccessDenied({ module }: { module?: string }) {
  return (
    <div className='text-muted-foreground flex flex-col items-center gap-2 py-16 text-center'>
      <ShieldOffIcon className='size-6' />
      <p className='text-foreground text-sm font-medium'>
        {module ? `You do not have access to ${module}.` : 'You do not have access to this page.'}
      </p>
      <p className='text-sm'>Ask an administrator if you need this added to your role.</p>
    </div>
  )
}
