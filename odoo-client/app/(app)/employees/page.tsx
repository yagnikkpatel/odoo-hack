import type { Metadata } from 'next'
import { cookies } from 'next/headers'

import EmployeesView from '@/features/employees'
import { viewCookieName } from '@/features/nexacrm/lib/view-preference'

export const metadata: Metadata = {
  title: 'Employees',
  description: 'Employee directory and profiles.',
}

export default async function EmployeesPage() {
  const preference = (await cookies()).get(viewCookieName('employees'))?.value
  const defaultView = preference === 'grid' ? 'grid' : 'table'
  return <EmployeesView defaultView={defaultView} />
}
