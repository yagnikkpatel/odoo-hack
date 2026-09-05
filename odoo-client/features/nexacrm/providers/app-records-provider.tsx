import type { ReactNode } from 'react'
import type { SessionUser } from '@/features/auth/auth-types'
import DataStoresInitializer from '@/features/hr/data-stores-initializer'
import { CurrentUserProvider } from '@/features/nexacrm/contexts/currentUserContext'
import UsersStoreHydrator from '@/features/nexacrm/store/users-store-hydrator'
import PeopleStoreHydrator from '@/features/nexacrm/store/people-store-hydrator'
import CompaniesStoreHydrator from '@/features/nexacrm/store/companies-store-hydrator'
import ActivitiesStoreHydrator from '@/features/nexacrm/store/activities-store-hydrator'
import OpportunitiesStoreHydrator from '@/features/nexacrm/store/opportunities-store-hydrator'
import TasksStoreHydrator from '@/features/nexacrm/store/tasks-store-hydrator'
import NotesStoreHydrator from '@/features/nexacrm/store/notes-store-hydrator'
import AttachmentsStoreHydrator from '@/features/nexacrm/store/attachments-store-hydrator'
import CalendarEventsStoreHydrator from '@/features/nexacrm/store/calendar-events-store-hydrator'
import EmailsStoreHydrator from '@/features/nexacrm/store/emails-store-hydrator'

/** Authentication is connected; record APIs deliberately remain disconnected.
 * Only the backend-verified identity enters the user store. Other stores are empty.
 */
export default function AppRecordsProvider({ user: session, children }: { user: SessionUser; children: ReactNode }) {
  const user = { id: session.id, email: session.email, role: session.role, name: session.name || session.email }
  return (
    <CurrentUserProvider user={user}>
      <UsersStoreHydrator data={[user]} />
      <PeopleStoreHydrator data={[]} />
      <CompaniesStoreHydrator data={[]} />
      <ActivitiesStoreHydrator data={[]} />
      <OpportunitiesStoreHydrator data={[]} />
      <TasksStoreHydrator data={{ tasks: [], taskTargets: [] }} />
      <NotesStoreHydrator data={{ notes: [], noteTargets: [] }} />
      <AttachmentsStoreHydrator data={[]} />
      <CalendarEventsStoreHydrator data={[]} />
      <EmailsStoreHydrator data={[]} />
      <DataStoresInitializer />
      {children}
    </CurrentUserProvider>
  )
}
