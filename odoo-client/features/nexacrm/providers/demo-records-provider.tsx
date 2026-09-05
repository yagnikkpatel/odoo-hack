import type { ReactNode } from 'react'

import { CurrentUserProvider } from '@/features/nexacrm/contexts/currentUserContext'
import { getCurrentUser, getUsers } from '@/features/nexacrm/services/auth-service'
import { getPeople } from '@/features/nexacrm/services/person-service'
import { getCompanies } from '@/features/nexacrm/services/company-service'
import { getActivities } from '@/features/nexacrm/services/activity-service'
import { getOpportunities } from '@/features/nexacrm/services/opportunity-service'
import { getTasksData } from '@/features/nexacrm/services/task-service'
import { getNotesData } from '@/features/nexacrm/services/note-service'
import { getAttachments } from '@/features/nexacrm/services/attachment-service'
import { getCalendarEvents } from '@/features/nexacrm/services/calendar-event-service'
import { getEmails } from '@/features/nexacrm/services/email-service'
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

/** Same demo data/providers as NexaCRM, shared by the extracted app views.
 * This is a UI preview, not backend authorization or persistent employee storage.
 */
export default async function DemoRecordsProvider({ children }: { children: ReactNode }) {
  const [user, users, people, companies, activities, opportunities, tasks, notes, attachments, events, emails] =
    await Promise.all([
      getCurrentUser(), getUsers(), getPeople(), getCompanies(), getActivities(), getOpportunities(),
      getTasksData(), getNotesData(), getAttachments(), getCalendarEvents(), getEmails()
    ])

  return (
    <CurrentUserProvider user={user}>
      <UsersStoreHydrator data={users} />
      <CompaniesStoreHydrator data={companies} />
      <ActivitiesStoreHydrator data={activities} />
      <PeopleStoreHydrator data={people} />
      <OpportunitiesStoreHydrator data={opportunities} />
      <TasksStoreHydrator data={tasks} />
      <NotesStoreHydrator data={notes} />
      <AttachmentsStoreHydrator data={attachments} />
      <CalendarEventsStoreHydrator data={events} />
      <EmailsStoreHydrator data={emails} />
      {children}
    </CurrentUserProvider>
  )
}
