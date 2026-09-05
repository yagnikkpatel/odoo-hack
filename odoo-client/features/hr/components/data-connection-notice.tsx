import { DatabaseIcon } from 'lucide-react'
import { DATA_API_CONNECTED, DATA_CONNECTION_MESSAGE } from '../data-availability'

export default function DataConnectionNotice() {
  if (DATA_API_CONNECTED) return null
  return (
    <div
      role='status'
      className='bg-muted/30 text-muted-foreground flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm'
    >
      <DatabaseIcon className='mt-0.5 size-4 shrink-0' />
      <p>{DATA_CONNECTION_MESSAGE} Creating and updating records is unavailable until then.</p>
    </div>
  )
}
