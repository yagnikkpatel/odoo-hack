// Component Imports
import { Skeleton } from '@/features/nexacrm/components/ui/skeleton'

const RecordPanelLoader = () => (
  <div className='space-y-3'>
    {Array.from({ length: 3 }, (_, index) => (
      <div key={index} className='flex items-center gap-3'>
        <Skeleton className='size-5 shrink-0 rounded-md' />
        <Skeleton className='h-4 flex-1' />
        <Skeleton className='size-6 shrink-0 rounded-full' />
      </div>
    ))}
  </div>
)

export default RecordPanelLoader
