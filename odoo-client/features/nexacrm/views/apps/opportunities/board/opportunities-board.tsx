'use client'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { toast } from 'sonner'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { buildBlankOpportunityInput, opportunityStageLabel } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import RecordKanban from '@/features/nexacrm/components/kanban/record-kanban'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'
import { useOpportunityStagesStore } from '@/features/nexacrm/store/use-opportunity-stages-store'

// Util Imports
import { formatCompactCurrency } from '@/features/nexacrm/utils/format'

// Local Imports
import OpportunityCard from './opportunity-card'

type OpportunitiesBoardProps = {
  table: Table<Opportunity>
  onOpenRecord: (id: string) => void
}

const OpportunitiesBoard = ({ table, onOpenRecord }: OpportunitiesBoardProps) => {
  const setOpportunityStage = useOpportunitiesStore(state => state.setOpportunityStage)
  const addOpportunity = useOpportunitiesStore(state => state.addOpportunity)
  const deleteOpportunity = useOpportunitiesStore(state => state.deleteOpportunity)
  const { can } = useCurrentUser()

  const canDelete = can('records:delete')

  return (
    <RecordKanban
      table={table}
      stagesStore={useOpportunityStagesStore}
      canEdit={can('records:update')}
      getId={opportunity => opportunity.id}
      getStage={opportunity => opportunity.stage}
      onStageChange={(opportunity, stage) => setOpportunityStage(opportunity.id, stage)}
      addItemLabel='Add opportunity'
      addItemPlaceholder='Opportunity name'
      onAddRecord={(stage, name) => {
        const id = addOpportunity({ ...buildBlankOpportunityInput(), name: name.trim(), stage })

        toast.success(`${name.trim() || 'Opportunity'} added to ${opportunityStageLabel(stage)}.`)
        onOpenRecord(id)
      }}
      renderColumnMeta={(stage, records) => {
        const total = records.reduce((sum, opportunity) => sum + opportunity.amount, 0)

        if (!total) return null

        return (
          <span className='text-muted-foreground shrink-0 text-xs tabular-nums'>{formatCompactCurrency(total)}</span>
        )
      }}
      renderCard={(opportunity, mode) => (
        <OpportunityCard
          key={opportunity.id}
          opportunity={opportunity}
          mode={mode}
          onOpen={() => onOpenRecord(opportunity.id)}
          onDelete={canDelete ? () => deleteOpportunity(opportunity.id) : undefined}
        />
      )}
    />
  )
}

export default OpportunitiesBoard
