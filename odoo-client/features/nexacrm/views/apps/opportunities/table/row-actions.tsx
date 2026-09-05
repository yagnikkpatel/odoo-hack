'use client'

// Third-party Imports
import type { Row, Table } from '@tanstack/react-table'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { opportunityDisplayName } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import RowActionShell from '@/features/nexacrm/components/data-table/row-action-shell'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useOpportunitiesStore } from '@/features/nexacrm/store/use-opportunities-store'

const OpportunityRowActions = ({ row, table }: { row: Row<Opportunity>; table: Table<Opportunity> }) => {
  const opportunity = row.original
  const deleteOpportunity = useOpportunitiesStore(state => state.deleteOpportunity)
  const { can } = useCurrentUser()
  const onEditRow = table.options.meta?.onEditRow
  const label = opportunityDisplayName(opportunity)

  return (
    <RowActionShell
      viewHref={`/opportunities/${opportunity.id}`}
      onEdit={can('records:update') && onEditRow ? () => onEditRow(opportunity) : undefined}
      label={`Actions for ${label}`}
      onDelete={can('records:delete') ? () => deleteOpportunity(opportunity.id) : undefined}
      deleteTitle='Delete opportunity'
      deleteDescription={
        <>
          This will permanently remove <span className='text-foreground font-medium'>{label}</span>. This action cannot
          be undone.
        </>
      }
    />
  )
}

export default OpportunityRowActions
