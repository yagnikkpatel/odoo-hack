'use client'

// Third-party Imports
import { PlusIcon } from 'lucide-react'

// Type Imports
import type { Person } from '@/features/nexacrm/types/apps/person-types'
import { buildBlankPersonInput } from '@/features/nexacrm/types/apps/person-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { useRecordViewType } from '@/features/nexacrm/components/data-table/record-view-bar'
import type { RecordViewType } from '@/features/nexacrm/components/data-table/record-view-bar'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { usePeopleStore } from '@/features/nexacrm/store/use-people-store'

// Util Imports
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { rememberViewType } from '@/features/nexacrm/lib/view-preference'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'

// Local Imports
import PeopleCalendar from './calendar/people-calendar'
import PeopleGrid from './grid'
import PeoplePanel, { usePersonPreview } from './people-panel'
import PeopleStatsCards from './stats-cards'
import PeopleTable from './table/people-table'
import PeopleTableToolbar from './table/table-toolbar'
import { usePeopleTable } from './table/use-people-table'

const VIEW_NAMES: Partial<Record<RecordViewType, string>> = { grid: 'Grid', calendar: 'Calendar' }

const PeopleView = ({ defaultView }: { defaultView: RecordViewType }) => {
  const { can } = useCurrentUser()
  const addPerson = usePeopleStore(state => state.addPerson)
  const [, setPreviewId] = usePersonPreview()
  const [viewType, setViewType] = useRecordViewType(defaultView)

  const selectView = (next: RecordViewType) => {
    rememberViewType('people', next)
    setViewType(next)
  }

  const openCreate = () => setPreviewId(addPerson(buildBlankPersonInput()))

  const openEdit = (person: Person) => setPreviewId(person.id)

  const { table, showSummary, setShowSummary, isFiltered, visibleCount } = usePeopleTable({ onEditPerson: openEdit })

  const renderBody = () => {
    if (viewType === 'grid') return <PeopleGrid table={table} onOpenRecord={setPreviewId} />
    if (viewType === 'calendar') return <PeopleCalendar table={table} onOpenRecord={setPreviewId} />

    return <PeopleTable table={table} rowCount={visibleCount} isFiltered={isFiltered} showSummary={showSummary} />
  }

  const createAction = can('records:create') ? (
    <Button size='sm' className={ACCENT_ICON_BUTTON} onClick={openCreate}>
      <PlusIcon />
      <span className='max-sm:hidden'>New person</span>
    </Button>
  ) : null

  return (
    <div className='flex min-h-full flex-col'>
      <PeopleTableToolbar
        table={table}
        viewName={VIEW_NAMES[viewType] ?? 'All People'}
        count={visibleCount}
        showSummary={showSummary}
        onShowSummaryChange={setShowSummary}
        viewType={viewType}
        onViewTypeChange={selectView}
        actions={createAction}
      />

      <div className={PAGE_BODY}>
        <PeopleStatsCards />

        {renderBody()}
      </div>

      <PeoplePanel />
    </div>
  )
}

export default PeopleView
