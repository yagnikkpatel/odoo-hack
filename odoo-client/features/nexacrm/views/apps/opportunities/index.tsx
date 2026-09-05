'use client'

// Third-party Imports
import { PlusIcon } from 'lucide-react'

// Type Imports
import { buildBlankOpportunityInput } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import DataConnectionNotice from '@/features/hr/components/data-connection-notice'
import { useRecordViewType } from '@/features/nexacrm/components/data-table/record-view-bar'
import type { RecordViewType } from '@/features/nexacrm/components/data-table/record-view-bar'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'

// Util Imports
import { ACCENT_ICON_BUTTON } from '@/features/nexacrm/lib/accent'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { rememberViewType } from '@/features/nexacrm/lib/view-preference'

// Local Imports
import OpportunitiesStatsCards from './stats-cards'
import OpportunitiesBoard from './board/opportunities-board'
import OpportunitiesCalendar from './calendar/opportunities-calendar'
import OpportunityPanel, { useOpportunityPreview } from './opportunity-panel'
import OpportunitiesTable from './table/opportunities-table'
import OpportunitiesTableToolbar from './table/table-toolbar'
import { useOpportunitiesTable } from './table/use-opportunities-table'

const VIEW_NAMES: Partial<Record<RecordViewType, string>> = { kanban: 'By Stage', calendar: 'Calendar' }

const OpportunitiesView = ({ defaultView }: { defaultView: RecordViewType }) => {
  const { can } = useCurrentUser()
  const addOpportunity = useOpportunitiesStore(state => state.addOpportunity)
  const [, setPreviewId] = useOpportunityPreview()
  const [viewType, setViewType] = useRecordViewType(defaultView)

  const selectView = (next: RecordViewType) => {
    rememberViewType('opportunities', next)
    setViewType(next)
  }

  const openCreate = () => setPreviewId(addOpportunity(buildBlankOpportunityInput()))

  const openEdit = (opportunity: { id: string }) => setPreviewId(opportunity.id)

  const { table, showSummary, setShowSummary, isFiltered, visibleCount } = useOpportunitiesTable({
    onEditOpportunity: openEdit
  })

  const renderBody = () => {
    if (viewType === 'kanban') return <OpportunitiesBoard table={table} onOpenRecord={setPreviewId} />
    if (viewType === 'calendar') return <OpportunitiesCalendar table={table} onOpenRecord={setPreviewId} />

    return (
      <OpportunitiesTable table={table} rowCount={visibleCount} isFiltered={isFiltered} showSummary={showSummary} />
    )
  }

  const createAction = can('records:create') ? (
    <Button size='sm' className={ACCENT_ICON_BUTTON} onClick={openCreate}>
      <PlusIcon />
      <span className='max-sm:hidden'>New opportunity</span>
    </Button>
  ) : null

  return (
    <div className='flex min-h-full flex-col'>
      <OpportunitiesTableToolbar
        table={table}
        viewName={VIEW_NAMES[viewType] ?? 'All Opportunities'}
        count={visibleCount}
        showSummary={showSummary}
        onShowSummaryChange={setShowSummary}
        viewType={viewType}
        onViewTypeChange={selectView}
        actions={createAction}
      />

      <div className={PAGE_BODY}>
        <DataConnectionNotice />
        <OpportunitiesStatsCards />

        {renderBody()}
      </div>

      <OpportunityPanel />
    </div>
  )
}

export default OpportunitiesView
