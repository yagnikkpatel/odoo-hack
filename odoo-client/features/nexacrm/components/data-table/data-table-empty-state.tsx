// React Imports
import type { ReactNode } from 'react'

// Third-party Imports
import type { LucideIcon } from 'lucide-react'

const DataTableEmptyState = ({
  icon: Icon,
  title,
  description,
  action
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}) => (
  <div className='flex flex-col items-center justify-center gap-3 py-10 text-center'>
    <span className='bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-lg'>
      <Icon className='size-4.5' />
    </span>
    <div className='space-y-1'>
      <p className='text-foreground text-sm font-medium'>{title}</p>
      <p className='text-muted-foreground mx-auto max-w-xs text-sm text-pretty'>{description}</p>
    </div>
    {action}
  </div>
)

export default DataTableEmptyState
