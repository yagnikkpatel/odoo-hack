import type { Metadata } from 'next'
import { connection } from 'next/server'

import OpportunitiesView from '@/features/nexacrm/views/apps/opportunities'

export const metadata: Metadata = { title: 'Kanban', description: 'Original NexaCRM opportunity Kanban board preview.' }

export default async function KanbanPage() {
  // This page always opens as a board. Query parameters can select the original
  // table/calendar controls without changing the Employees page's preference.
  await connection()
  return <OpportunitiesView defaultView='kanban' />
}
