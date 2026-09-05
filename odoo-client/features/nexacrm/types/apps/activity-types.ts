// Third-party Imports
import type * as Icon from 'lucide-react'

// Type Imports
import type { ParentRef } from '@/features/nexacrm/types/apps/record-ref'

export type ActivityIconName = keyof typeof Icon

export const ACTIVITY_TYPES = ['note', 'email', 'call', 'meeting', 'task', 'file', 'status'] as const

export type ActivityType = (typeof ACTIVITY_TYPES)[number]

export type Activity = ParentRef & {
  id: string
  type: ActivityType
  actorId?: string

  /** Past-tense phrase describing what happened - "scheduled", "added a note". */
  verb: string

  /** The thing acted on; rendered emphasised after the verb. */
  subject: string

  /** Optional second line: either prose or event metadata ("8:15 AM to 9:45 AM · Google Meet"). */
  body?: string

  /** ISO timestamp. May be in the future for scheduled events. */
  occurredAt: string

  changes?: ActivityChange[]
}

export type ActivityChange = { label: string; value?: string }

export type ActivityInput = Omit<Activity, 'id' | 'occurredAt'> & { occurredAt?: string }

export const ACTIVITY_TYPE_META: Record<ActivityType, { label: string; icon: ActivityIconName }> = {
  note: { label: 'Note', icon: 'StickyNoteIcon' },
  email: { label: 'Email', icon: 'MailIcon' },
  call: { label: 'Call', icon: 'PhoneIcon' },
  meeting: { label: 'Meeting', icon: 'CalendarIcon' },
  task: { label: 'Task', icon: 'CircleCheckIcon' },
  file: { label: 'File', icon: 'PaperclipIcon' },
  status: { label: 'Status', icon: 'ArrowRightLeftIcon' }
}

export const ACTIVITY_FILTERS = ['everything', 'conversations', 'meetings', 'emails', 'system'] as const

export type ActivityFilter = (typeof ACTIVITY_FILTERS)[number]

export const ACTIVITY_FILTER_LABELS: Record<ActivityFilter, string> = {
  everything: 'Everything',
  conversations: 'Conversations',
  meetings: 'Meetings',
  emails: 'Emails',
  system: 'System updates'
}

const ACTIVITY_FILTER_TYPES: Record<ActivityFilter, ActivityType[] | null> = {
  everything: null,
  conversations: ['note', 'call', 'email'],
  meetings: ['meeting'],
  emails: ['email'],
  system: ['status', 'file', 'task']
}

export const matchesActivityFilter = (type: ActivityType, filter: ActivityFilter): boolean => {
  const allowed = ACTIVITY_FILTER_TYPES[filter]

  return allowed === null || allowed.includes(type)
}
