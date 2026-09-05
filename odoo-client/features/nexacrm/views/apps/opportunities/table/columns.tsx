'use client'

// Third-party Imports
import type { ColumnDef } from '@tanstack/react-table'
import {
  Building2Icon,
  CalendarIcon,
  CircleDotIcon,
  DollarSignIcon,
  FlagIcon,
  PercentIcon,
  TargetIcon,
  UserIcon,
  UserPlusIcon,
  UserRoundIcon,
  WaypointsIcon
} from 'lucide-react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import {
  OPPORTUNITY_OUTCOME_LABELS,
  OPPORTUNITY_OUTCOME_OPTIONS,
  OPPORTUNITY_OUTCOME_TONES,
  OPPORTUNITY_SOURCE_LABELS,
  OPPORTUNITY_SOURCE_OPTIONS,
  OPPORTUNITY_STAGE_OPTIONS,
  opportunityStageLabel,
  opportunityStageTone
} from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import DataTableColumnHeader from '@/features/nexacrm/components/data-table/data-table-column-header'
import OwnerCell from '@/features/nexacrm/components/record/owner-cell'
import UserChip from '@/features/nexacrm/components/record/user-chip'
import StageBadge from '@/features/nexacrm/components/kanban/stage-badge'

// Store Imports
import { useOpportunityStagesStore } from '@/features/nexacrm/store/use-opportunity-stages-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { BADGE_TONES } from '@/features/nexacrm/lib/badge-tone'
import { containsFilter } from '@/features/nexacrm/utils/table-filters'
import { formatCompactCurrency, formatDate } from '@/features/nexacrm/utils/format'

// Local Imports
import { OpportunityCompanyCell, OpportunityNameCell, OpportunityPointOfContactCell } from '../opportunities-cells'
import OpportunityRowActions from './row-actions'

export const REORDERABLE_COLUMN_IDS = [
  'name',
  'amount',
  'createdById',
  'closeDate',
  'companyId',
  'pointOfContactId',
  'stage',
  'ownerId',
  'outcome',
  'source',
  'probability'
]

export const INITIAL_COLUMN_ORDER = ['select', ...REORDERABLE_COLUMN_IDS, 'actions']

/** The fields this view starts with hidden. Seeds `columnVisibility`, not a removal. */
export const HIDDEN_BY_DEFAULT_COLUMNS = {
  stage: false,
  ownerId: false,
  outcome: false,
  source: false,
  probability: false
}

export const columns: ColumnDef<Opportunity>[] = [
  {
    id: 'select',
    size: 44,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGlobalFilter: false,

    meta: { cellClassName: 'px-0' },
    header: ({ table }) => (
      <div className='flex items-center justify-center'>
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()}
          onCheckedChange={value => table.toggleAllPageRowsSelected(!!value)}
          aria-label='Select all'
        />
      </div>
    ),
    cell: ({ row }) => (
      <div className='flex items-center justify-center'>
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={value => row.toggleSelected(!!value)}
          aria-label='Select row'
        />
      </div>
    )
  },
  {
    accessorKey: 'name',
    size: 240,
    meta: { label: 'Name', icon: TargetIcon, textFilter: true },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Name' />,
    cell: ({ row }) => <OpportunityNameCell opportunity={row.original} />,
    filterFn: containsFilter
  },
  {
    accessorKey: 'amount',
    size: 120,
    enableGlobalFilter: false,
    meta: { label: 'Amount', icon: DollarSignIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Amount' />,

    cell: ({ row }) => <span className='tabular-nums'>{formatCompactCurrency(row.original.amount)}</span>
  },
  {
    accessorKey: 'createdById',
    size: 170,
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { label: 'Created by', icon: UserPlusIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Created by' />,

    cell: ({ row }) => <UserChip userId={row.original.createdById} />,
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'closeDate',
    size: 140,
    enableGlobalFilter: false,
    meta: { label: 'Close date', icon: CalendarIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Close date' />,
    cell: ({ row }) =>
      row.original.closeDate ? (
        <span className='text-muted-foreground whitespace-nowrap'>{formatDate(row.original.closeDate)}</span>
      ) : (
        <span className='text-muted-foreground'>-</span>
      )
  },
  {
    accessorKey: 'companyId',
    size: 180,
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { label: 'Company', icon: Building2Icon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Company' />,
    cell: ({ row }) => <OpportunityCompanyCell companyId={row.original.companyId} />,
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'pointOfContactId',
    size: 180,
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { label: 'Point of Contact', icon: UserRoundIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Point of Contact' />,
    cell: ({ row }) => <OpportunityPointOfContactCell personId={row.original.pointOfContactId} />,
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'stage',
    size: 130,
    enableGlobalFilter: false,
    meta: { label: 'Stage', icon: CircleDotIcon, filterOptions: OPPORTUNITY_STAGE_OPTIONS },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Stage' />,
    cell: ({ row }) => (
      <StageBadge
        stagesStore={useOpportunityStagesStore}
        stage={row.original.stage}
        fallbackLabel={opportunityStageLabel(row.original.stage)}
        fallbackTone={opportunityStageTone(row.original.stage)}
      />
    ),
    filterFn: (row, columnId, filterValue) => String(row.getValue(columnId)) === filterValue
  },
  {
    accessorKey: 'ownerId',
    size: 170,
    enableSorting: false,
    enableGlobalFilter: false,
    meta: { label: 'Owner', icon: UserIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Owner' />,
    cell: ({ row }) => <OwnerCell ownerId={row.original.ownerId} />,
    filterFn: (row, columnId, filterValue) => row.getValue(columnId) === filterValue
  },
  {
    accessorKey: 'outcome',
    size: 120,
    enableGlobalFilter: false,
    meta: { label: 'Outcome', icon: FlagIcon, filterOptions: OPPORTUNITY_OUTCOME_OPTIONS },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Outcome' />,
    cell: ({ row }) => (
      <Badge variant='secondary' className={cn(BADGE_TONES[OPPORTUNITY_OUTCOME_TONES[row.original.outcome]])}>
        {OPPORTUNITY_OUTCOME_LABELS[row.original.outcome]}
      </Badge>
    ),
    filterFn: (row, columnId, filterValue) => String(row.getValue(columnId)) === filterValue
  },
  {
    accessorKey: 'source',
    size: 130,
    enableGlobalFilter: false,
    meta: { label: 'Source', icon: WaypointsIcon, filterOptions: OPPORTUNITY_SOURCE_OPTIONS },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Source' />,

    cell: ({ row }) => (
      <Badge variant='secondary' className={cn(BADGE_TONES.neutral)}>
        {OPPORTUNITY_SOURCE_LABELS[row.original.source]}
      </Badge>
    ),
    filterFn: (row, columnId, filterValue) => String(row.getValue(columnId)) === filterValue
  },
  {
    accessorKey: 'probability',
    size: 120,
    enableGlobalFilter: false,
    meta: { label: 'Probability', icon: PercentIcon },
    header: ({ column }) => <DataTableColumnHeader column={column} title='Probability' />,
    cell: ({ row }) => <span className='tabular-nums'>{row.original.probability}%</span>
  },
  {
    id: 'actions',
    size: 48,
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    enableGlobalFilter: false,
    header: () => <span className='sr-only'>Actions</span>,
    cell: ({ row, table }) => <OpportunityRowActions row={row} table={table} />
  }
]
