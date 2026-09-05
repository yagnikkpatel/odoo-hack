'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { ArrowLeftIcon, DownloadIcon, EllipsisVerticalIcon, StarIcon, Trash2Icon } from 'lucide-react'

// Type Imports
import type { Opportunity } from '@/features/nexacrm/types/apps/opportunity-types'
import { opportunityDisplayName, opportunityStageLabel, opportunityStageTone } from '@/features/nexacrm/types/apps/opportunity-types'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'
import { SidePanelTrigger } from '@/features/nexacrm/components/layout/side-panel'
import EditableTitle from '@/features/nexacrm/components/record/editable-title'
import StageBadge from '@/features/nexacrm/components/kanban/stage-badge'
import RecordNavigation from '@/features/nexacrm/components/record/record-navigation'

// Context Imports
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'

// Store Imports
import { useFavoritesStore, useIsFavorite } from '@/features/nexacrm/store/use-favorites-store'
import { useOpportunitiesStore, useOpportunityNavigation } from '@/features/nexacrm/store/use-opportunities-store'
import { useOpportunityStagesStore } from '@/features/nexacrm/store/use-opportunity-stages-store'

// Util Imports
import { cn } from '@/features/nexacrm/lib/utils'

// Local Imports
import { useOpportunityExport } from '../table/use-opportunity-export'

const OpportunityDetailHeader = ({
  opportunity,
  onDelete,
  onOpenPanel
}: {
  opportunity: Opportunity
  onDelete: () => void
  onOpenPanel: () => void
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const { can } = useCurrentUser()
  const { index, total, previousId, nextId } = useOpportunityNavigation(opportunity.id)
  const updateOpportunity = useOpportunitiesStore(state => state.updateOpportunity)
  const exportOpportunities = useOpportunityExport()
  const isFavorite = useIsFavorite('opportunity', opportunity.id)
  const toggleFavorite = useFavoritesStore(state => state.toggle)

  return (
    <div className='flex shrink-0 items-center gap-3 border-b py-2'>
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Back to opportunities'
        nativeButton={false}
        render={<Link href='/opportunities' />}
        className='text-muted-foreground hover:text-foreground -ml-1 shrink-0'
      >
        <ArrowLeftIcon />
      </Button>

      <div className='flex min-w-0 flex-1 items-center gap-2'>
        <h1 className='min-w-0'>
          <EditableTitle
            key={opportunity.id}
            value={opportunity.name}
            canEdit={can('records:update')}
            onCommit={name => updateOpportunity(opportunity.id, { name })}
            ariaLabel='Opportunity name'
            className='text-base font-semibold tracking-tight'
          />
        </h1>

        <StageBadge
          stagesStore={useOpportunityStagesStore}
          stage={opportunity.stage}
          fallbackLabel={opportunityStageLabel(opportunity.stage)}
          fallbackTone={opportunityStageTone(opportunity.stage)}
          className='shrink-0 max-sm:hidden'
        />
      </div>

      <div className='flex shrink-0 items-center gap-1'>
        <RecordNavigation
          index={index}
          total={total}
          moduleLabel='Opportunities'
          previousHref={previousId ? `/opportunities/${previousId}` : undefined}
          nextHref={nextId ? `/opportunities/${nextId}` : undefined}
        />

        <SidePanelTrigger side='left' breakpoint='xl' label='Show opportunity details' onClick={onOpenPanel} />

        <Button
          variant='ghost'
          size='icon-sm'
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          aria-pressed={isFavorite}
          onClick={() => toggleFavorite('opportunity', opportunity.id)}
          className={cn('text-muted-foreground', isFavorite && 'text-amber-500 hover:text-amber-500!')}
        >
          <StarIcon className={cn(isFavorite && 'fill-amber-400')} />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant='ghost'
                size='icon-sm'
                aria-label='Opportunity actions'
                className='text-muted-foreground hover:text-foreground'
              />
            }
          >
            <EllipsisVerticalIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-56'>
            <DropdownMenuGroup>
              <DropdownMenuItem
                onClick={() => exportOpportunities([opportunity], `${opportunityDisplayName(opportunity)}.csv`)}
              >
                <DownloadIcon /> Export opportunity
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {can('records:delete') ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem variant='destructive' onClick={() => setConfirmOpen(true)}>
                    <Trash2Icon /> Delete opportunity
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {can('records:delete') ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title='Delete opportunity'
          description={`${opportunityDisplayName(opportunity)} will be permanently removed. This cannot be undone.`}
          confirmLabel='Delete'
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  )
}

export default OpportunityDetailHeader
