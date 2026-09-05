import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import PeopleView from '@/features/nexacrm/views/apps/people'
import { parseViewType, viewCookieName, viewTypesFor } from '@/features/nexacrm/lib/view-preference'

export const metadata: Metadata = { title: 'Employees', description: 'NexaCRM People UI preview.' }

export default async function EmployeesPage() {
  const preference = parseViewType((await cookies()).get(viewCookieName('people'))?.value)
  const defaultView = viewTypesFor('people').includes(preference) ? preference : 'table'
  return <PeopleView defaultView={defaultView} />
}
