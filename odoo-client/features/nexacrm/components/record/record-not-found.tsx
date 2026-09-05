// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ArrowLeftIcon, SearchXIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'

const RecordNotFound = ({
  label,
  backHref,
  backLabel
}: {

  /** Singular, capitalised - "Person", "Company", "Workflow run". */
  label: string

  /** The module's list route. */
  backHref: string

  /** Plural module name for the button - "People", "Companies". */
  backLabel: string
}) => (
  <div className='flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center'>
    <span className='bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg'>
      <SearchXIcon className='size-4.5' />
    </span>

    <div className='space-y-1'>
      <p className='text-foreground text-sm font-medium'>{label} not found</p>
      <p className='text-muted-foreground mx-auto max-w-xs text-sm text-pretty'>
        This {label.toLowerCase()} does not exist, or it was deleted. It may have been removed from another tab.
      </p>
    </div>

    <Button variant='outline' size='sm' nativeButton={false} render={<Link href={backHref} />}>
      <ArrowLeftIcon />
      Back to {backLabel}
    </Button>
  </div>
)

export default RecordNotFound
