// Third-party Imports
import type * as Icon from 'lucide-react'

type IconName = keyof typeof Icon

export const RECORD_VIEW_TYPES = ['table', 'kanban', 'grid', 'calendar'] as const

export type RecordViewType = (typeof RECORD_VIEW_TYPES)[number]

export const RECORD_VIEW_META: Record<RecordViewType, { label: string; icon: IconName }> = {
  table: { label: 'Table', icon: 'TableIcon' },
  kanban: { label: 'Kanban', icon: 'KanbanIcon' },
  grid: { label: 'Grid', icon: 'LayoutGridIcon' },
  calendar: { label: 'Calendar', icon: 'CalendarDaysIcon' }
}

export type RecordModule = {
  key: string
  label: string
  href: string
  viewTypes: readonly RecordViewType[]
}

export const RECORD_MODULES: readonly RecordModule[] = [
  { key: 'companies', label: 'Companies', href: '/companies', viewTypes: ['table', 'kanban', 'calendar'] },

  { key: 'people', label: 'People', href: '/employees', viewTypes: ['table', 'grid', 'calendar'] },

  { key: 'opportunities', label: 'Opportunities', href: '/opportunities', viewTypes: ['table', 'kanban', 'calendar'] },

  { key: 'tasks', label: 'Tasks', href: '/tasks', viewTypes: ['table', 'kanban', 'calendar'] },

  { key: 'notes', label: 'Notes', href: '/notes', viewTypes: ['table', 'kanban', 'calendar'] }
]

export const viewTypesFor = (key: string): readonly RecordViewType[] =>
  RECORD_MODULES.find(module => module.key === key)?.viewTypes ?? ['table']

/** Every module that can draw `type` - what the sidebar's Views section groups by. */
export const modulesWithViewType = (type: RecordViewType): readonly RecordModule[] =>
  RECORD_MODULES.filter(module => module.viewTypes.includes(type))

/** Cookie holding the last view chosen for `module`. Namespaced so two lists never collide. */
export const viewCookieName = (module: string) => `nexacrm.view.${module}`

/** Narrows an untrusted cookie value (or `undefined`) to a view this app can actually render. */
export const parseViewType = (value: string | undefined, fallback: RecordViewType = 'table'): RecordViewType =>
  RECORD_VIEW_TYPES.includes(value as RecordViewType) ? (value as RecordViewType) : fallback

export const rememberViewType = (module: string, view: RecordViewType) => {
  document.cookie = `${viewCookieName(module)}=${view}; path=/; max-age=31536000; samesite=lax`
}
