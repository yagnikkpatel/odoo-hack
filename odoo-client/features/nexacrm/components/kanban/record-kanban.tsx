'use client'

// React Imports
import { useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'

// Third-party Imports
import { closestCenter, pointerWithin } from '@dnd-kit/core'
import type { CollisionDetection } from '@dnd-kit/core'
import type { Table } from '@tanstack/react-table'
import { EllipsisVerticalIcon, GripVerticalIcon, PencilIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Card, CardContent, CardHeader } from '@/features/nexacrm/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/features/nexacrm/components/ui/dropdown-menu'
import {
  Kanban,
  KanbanAddColumn,
  KanbanAddItem,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanOverlay
} from '@/features/nexacrm/components/ui/kanban'
import { ScrollArea, ScrollBar } from '@/features/nexacrm/components/ui/scroll-area'
import StageEditDialog from '@/features/nexacrm/components/kanban/stage-edit-dialog'

// Store Imports
import type { StagesStoreHook } from '@/features/nexacrm/store/create-stages-store'

// Util Imports
import type { BadgeTone } from '@/features/nexacrm/lib/badge-tone'
import { BADGE_TONES } from '@/features/nexacrm/lib/badge-tone'
import { cn } from '@/features/nexacrm/lib/utils'

export type KanbanCardMode = 'board' | 'dragged' | 'carried' | 'readonly'

export const isCardDraggable = (mode: KanbanCardMode) => mode === 'board'

export const isCardClickable = (mode: KanbanCardMode) => mode === 'board' || mode === 'readonly'

/*
 * ! Rows come from `table.getPrePaginationRowModel()` - see the row-model note in
 * ! `components/calendar/record-calendar`. The other two models fail silently.
 */
export type RecordKanbanProps<TData> = {
  table: Table<TData>
  stagesStore: StagesStoreHook

  /** The column a record belongs in. Must always return a stage id, never undefined. */
  getStage: (record: TData) => string
  onStageChange: (record: TData, stage: string) => void
  getId: (record: TData) => string
  renderCard: (record: TData, mode: KanbanCardMode) => ReactNode
  onAddRecord?: (stage: string, title: string) => void
  addItemLabel?: string
  addItemPlaceholder?: string
  canEdit: boolean

  renderColumnMeta?: (stage: string, records: TData[]) => ReactNode
}

const RecordKanban = <TData,>({
  table,
  stagesStore,
  getStage,
  onStageChange,
  getId,
  renderCard,
  onAddRecord,
  addItemLabel = 'Add record',
  addItemPlaceholder = 'Name',
  canEdit,
  renderColumnMeta
}: RecordKanbanProps<TData>) => {
  const stages = stagesStore(state => state.stages)
  const labels = stagesStore(state => state.labels)
  const tones = stagesStore(state => state.tones)
  const cardOrder = stagesStore(state => state.cardOrder)
  const setStages = stagesStore(state => state.setStages)
  const setCardOrder = stagesStore(state => state.setCardOrder)
  const addStage = stagesStore(state => state.addStage)
  const renameStage = stagesStore(state => state.renameStage)
  const setStageTone = stagesStore(state => state.setStageTone)
  const deleteStage = stagesStore(state => state.deleteStage)
  const validateNewStage = stagesStore(state => state.validateNewStage)

  const [editingStage, setEditingStage] = useState<string | null>(null)

  const rows = table.getPrePaginationRowModel().rows

  const stageLabel = (stage: string) => labels[stage] ?? stage
  const stageTone = (stage: string): BadgeTone => tones[stage] ?? 'neutral'

  const columns = useMemo(() => {
    const grouped = Object.fromEntries(stages.map(stage => [stage, [] as TData[]])) as Record<string, TData[]>

    rows.forEach(row => {
      const stage = getStage(row.original)

      grouped[stages.includes(stage) ? stage : stages[0]]?.push(row.original)
    })

    if (cardOrder.length) {
      const rank = new Map(cardOrder.map((id, index) => [id, index]))
      const at = (id: string) => rank.get(id) ?? Number.MAX_SAFE_INTEGER

      Object.values(grouped).forEach(list => list.sort((a, b) => at(getId(a)) - at(getId(b))))
    }

    return grouped
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, stages, cardOrder])

  const handleValueChange: Dispatch<SetStateAction<Record<string, TData[]>>> = updater => {
    const next = typeof updater === 'function' ? updater(columns) : updater

    if (!canEdit) return

    Object.entries(next).forEach(([stage, list]) =>
      list.forEach(record => {
        if (getStage(record) !== stage) onStageChange(record, stage)
      })
    )

    setCardOrder(Object.values(next).flatMap(list => list.map(getId)))

    const nextOrder = Object.keys(next)

    if (nextOrder.length === stages.length && nextOrder.some((stage, index) => stage !== stages[index])) {
      setStages(nextOrder)
    }
  }

  const resolveCollision: CollisionDetection = args => {
    if (stages.includes(String(args.active.id))) {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter(container => stages.includes(String(container.id)))
      })
    }

    const pointerHits = pointerWithin(args)

    if (pointerHits.length) {
      const card = pointerHits.find(({ id }) => !stages.includes(String(id)))

      return card ? [card] : pointerHits.slice(0, 1)
    }

    const pointer = args.pointerCoordinates

    if (!pointer) return []

    return args.droppableContainers
      .filter(container => stages.includes(String(container.id)))
      .map(container => {
        const rect = args.droppableRects.get(container.id)

        if (!rect) return null

        const gap = pointer.x < rect.left ? rect.left - pointer.x : Math.max(0, pointer.x - rect.right)

        return { id: container.id, data: { droppableContainer: container, value: gap } }
      })
      .filter(hit => hit !== null)
      .sort((a, b) => a.data.value - b.data.value)
      .slice(0, 1)
  }

  const handleDeleteStage = (stage: string) => {
    const occupied = columns[stage]?.length ?? 0

    if (occupied) {
      toast.error(`Move the ${occupied} ${occupied === 1 ? 'record' : 'records'} out of ${stageLabel(stage)} first.`)

      return
    }

    deleteStage(stage)
  }

  const renderColumn = (stage: string, isOverlay: boolean) => (
    <Card
      data-testid={isOverlay ? undefined : `kanban-column-${stage}`}
      className={cn('bg-muted/50 w-72 shrink-0 gap-0 py-2.5', isOverlay && 'rotate-1 shadow-xl')}
    >
      <CardHeader className='flex items-center justify-between px-2.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <Badge variant='secondary' className={cn('shrink-0', BADGE_TONES[stageTone(stage)])}>
            {stageLabel(stage)}
          </Badge>
          <Badge variant='outline'>{columns[stage]?.length ?? 0}</Badge>
          {renderColumnMeta ? renderColumnMeta(stage, columns[stage] ?? []) : null}
        </div>

        {canEdit ? (
          <div className='flex items-center gap-1'>
            <KanbanColumnHandle
              render={handleProps => (
                <Button
                  {...handleProps}
                  size='icon-sm'
                  variant='ghost'
                  aria-label={`Reorder ${stageLabel(stage)}`}
                  className='text-muted-foreground'
                >
                  <GripVerticalIcon className='size-3.5' />
                </Button>
              )}
            />

            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button size='icon-sm' variant='ghost' aria-label={`${stageLabel(stage)} stage actions`} />}
              >
                <EllipsisVerticalIcon className='size-3.5' />
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-44'>
                <DropdownMenuItem onClick={() => setEditingStage(stage)}>
                  <PencilIcon /> Rename & colour
                </DropdownMenuItem>
                <DropdownMenuItem variant='destructive' onClick={() => handleDeleteStage(stage)}>
                  <Trash2Icon /> Delete stage
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className='flex flex-col gap-2.5 px-2.5 pt-2.5'>
        <KanbanColumnContent
          value={stage}
          className={cn('flex min-h-2 flex-col gap-2.5', (columns[stage]?.length ?? 0) === 0 && 'min-h-16')}
        >
          {(columns[stage] ?? []).map(record =>
            renderCard(record, isOverlay ? 'carried' : canEdit ? 'board' : 'readonly')
          )}
        </KanbanColumnContent>

        {canEdit && onAddRecord ? (
          <KanbanAddItem
            onAdd={title => onAddRecord(stage, title)}
            label={addItemLabel}
            placeholder={addItemPlaceholder}
          />
        ) : null}
      </CardContent>
    </Card>
  )

  return (
    <Kanban
      value={columns}
      onValueChange={handleValueChange}
      getItemValue={(record: TData) => getId(record)}
      collisionDetection={resolveCollision}
    >
      <ScrollArea>
        <div className='flex items-start gap-4 px-px pt-px pb-3'>
          <KanbanBoard className='flex items-start gap-4 p-0'>
            {stages.map(stage => (
              <KanbanColumn
                key={stage}
                value={stage}
                disabled={!canEdit}
                className={canEdit ? undefined : 'opacity-100'}
              >
                {renderColumn(stage, false)}
              </KanbanColumn>
            ))}
          </KanbanBoard>

          {canEdit ? <KanbanAddColumn onAdd={addStage} validate={validateNewStage} label='Add New Column' /> : null}
        </div>
        <ScrollBar orientation='horizontal' />
      </ScrollArea>

      <KanbanOverlay>
        {({ value, variant }) => {
          const record = variant === 'item' ? rows.map(row => row.original).find(item => getId(item) === value) : null

          return (
            <div data-testid='kanban-drag-overlay' className='pointer-events-none'>
              {variant === 'column' ? renderColumn(String(value), true) : record ? renderCard(record, 'dragged') : null}
            </div>
          )
        }}
      </KanbanOverlay>

      <StageEditDialog
        open={Boolean(editingStage)}
        onOpenChange={open => {
          if (!open) setEditingStage(null)
        }}
        label={editingStage ? stageLabel(editingStage) : ''}
        tone={editingStage ? stageTone(editingStage) : 'neutral'}
        onSave={(label, tone) => {
          if (!editingStage) return

          renameStage(editingStage, label)
          setStageTone(editingStage, tone)
        }}
      />
    </Kanban>
  )
}

export default RecordKanban
