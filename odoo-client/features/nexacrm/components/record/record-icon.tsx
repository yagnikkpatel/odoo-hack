// Type Imports
import type { ResolvedRecord } from '@/features/nexacrm/types/apps/resolved-record'
import { resolvedRecordLabel } from '@/features/nexacrm/types/apps/resolved-record'

// Component Imports
import { Avatar, AvatarFallback } from '@/features/nexacrm/components/ui/avatar'
import CompanyAvatar from '@/features/nexacrm/components/record/company-avatar'
import PersonAvatar from '@/features/nexacrm/components/record/person-avatar'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

const RecordIcon = ({ record, className = 'size-5!' }: { record: ResolvedRecord; className?: string }) => {
  if (record.entityType === 'company') {
    return <CompanyAvatar company={record.company} className={className} fallbackClassName='text-[10px]' />
  }

  if (record.entityType === 'person') {
    return (
      <PersonAvatar
        name={resolvedRecordLabel(record)}
        src={record.person.avatar}
        className={className}
        fallbackClassName='text-[10px]'
      />
    )
  }

  if (record.entityType === 'task' || record.entityType === 'note') {
    return (
      <RecordInitial
        label={resolvedRecordLabel(record)}
        seed={record.entityType === 'task' ? record.task.id : record.note.id}
        className={className}
      />
    )
  }

  return <RecordInitial label={resolvedRecordLabel(record)} seed={record.opportunity.id} className={className} />
}

const MARK_TINTS = [
  'bg-[#edf2fe] text-[#3a5bc7] dark:bg-[#182449] dark:text-[#9db1ff]',
  'bg-[#e6f6eb] text-[#00824d] dark:bg-[#132d21] dark:text-[#3dd68c]',
  'bg-[#f5f2ff] text-[#6550b9] dark:bg-[#25184a] dark:text-[#baa7ff]',
  'bg-[#ffefd6] text-[#d14e00] dark:bg-[#331e0b] dark:text-[#ff9b52]',
  'bg-[#feebec] text-[#ce2c31] dark:bg-[#3b1219] dark:text-[#ff8a88]'
] as const

const tintFor = (seed: string) => {
  let total = 0

  for (let index = 0; index < seed.length; index++) total += seed.charCodeAt(index)

  return MARK_TINTS[total % MARK_TINTS.length]
}

export const RecordInitial = ({
  label,
  seed,
  className = 'size-5!'
}: {
  label: string

  /** Stable identity for the colour. Falls back to the label when a caller has no id. */
  seed?: string
  className?: string
}) => (
  <Avatar className={cn('shrink-0 rounded-sm bg-transparent *:rounded-sm after:hidden', className)}>
    <AvatarFallback className={cn('text-[10px] font-medium uppercase', tintFor(seed ?? label))}>
      {label.trim().charAt(0) || '–'}
    </AvatarFallback>
  </Avatar>
)

export default RecordIcon
