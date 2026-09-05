// Third-party Imports
import { LinkIcon } from 'lucide-react'

const linkedinHandle = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, '')
  const segments = trimmed.split('/')

  return segments[segments.length - 1] || trimmed
}

const LinkedinCell = ({ url }: { url?: string }) => {
  if (!url?.trim()) return <span className='text-muted-foreground'>-</span>

  return (
    <div className='text-muted-foreground flex items-center gap-1.5'>
      <LinkIcon className='size-3.5 shrink-0' />
      <span className='truncate'>{linkedinHandle(url)}</span>
    </div>
  )
}

export default LinkedinCell
