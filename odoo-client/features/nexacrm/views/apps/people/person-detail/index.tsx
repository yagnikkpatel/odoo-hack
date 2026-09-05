'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import { useRouter } from 'next/navigation'

// Third-party Imports
import { LoaderCircleIcon } from 'lucide-react'

// Component Imports
import { ScrollArea } from '@/features/nexacrm/components/ui/scroll-area'
import SidePanel from '@/features/nexacrm/components/layout/side-panel'
import RecordNotFound from '@/features/nexacrm/components/record/record-not-found'
import type { SubRecordTarget } from '@/features/nexacrm/components/record/sub-record-sheet'
import SubRecordSheet, { NEW_EMAIL } from '@/features/nexacrm/components/record/sub-record-sheet'

// Type Imports
import { personDisplayName } from '@/features/nexacrm/types/apps/person-types'

// Store Imports
import { usePeopleStore, usePerson } from '@/features/nexacrm/store/use-people-store'
import { useRecordBreadcrumb } from '@/features/nexacrm/store/use-breadcrumb-store'

// Local Imports
import PersonDetailHeader from './detail-header'
import PersonDetailTabs from './detail-tabs'
import PersonFields from './person-fields'

const PersonDetailView = ({ personId, initialSection }: { personId: string; initialSection?: string }) => {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)
  const [railOpen, setRailOpen] = useState(false)
  const [subRecord, setSubRecord] = useState<SubRecordTarget | null>(null)

  const person = usePerson(personId)
  const hasHydrated = usePeopleStore(state => state.hasHydrated)
  const deletePerson = usePeopleStore(state => state.deletePerson)

  useRecordBreadcrumb(person ? personDisplayName(person) : undefined)

  if (!person) {
    if (hasHydrated && !isDeleting) {
      return <RecordNotFound label='Person' backHref='/employees' backLabel='People' />
    }

    return (
      <div className='flex flex-1 items-center justify-center py-16'>
        <LoaderCircleIcon className='text-muted-foreground size-5 animate-spin' />
      </div>
    )
  }

  const handleDelete = () => {
    setIsDeleting(true)
    deletePerson(person.id)
    router.push('/employees')
  }

  return (
    <div className='flex min-h-0 flex-col'>
      <PersonDetailHeader
        person={person}
        onDelete={handleDelete}
        onOpenPanel={() => setRailOpen(true)}
        onComposeEmail={() => setSubRecord({ kind: 'email', id: NEW_EMAIL })}
      />

      <div className='grid xl:min-h-0 xl:flex-1 xl:grid-cols-[20rem_minmax(0,1fr)] xl:grid-rows-[minmax(0,1fr)]'>
        <SidePanel
          side='left'
          breakpoint='xl'
          open={railOpen}
          onOpenChange={setRailOpen}
          title={`${personDisplayName(person)} details`}
          description='Contact details, company and record fields.'
          className='xl:min-h-0 xl:border-r'
        >
          <ScrollArea className='xl:h-full'>
            <div className='xl:py-4 xl:pr-4'>
              <PersonFields person={person} />
            </div>
          </ScrollArea>
        </SidePanel>

        <PersonDetailTabs person={person} initialSection={initialSection} onOpenSubRecord={setSubRecord} />
      </div>

      <SubRecordSheet
        target={subRecord}
        entityType='person'
        entityId={person.id}
        defaultEmailTo={person.email}
        onClose={() => setSubRecord(null)}
      />
    </div>
  )
}

export default PersonDetailView
