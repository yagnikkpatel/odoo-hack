'use client'

// React Imports
import { useId } from 'react'

// Third-party Imports
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Column, Table } from '@tanstack/react-table'
import {
  Columns3Icon,
  DownloadIcon,
  GripVerticalIcon,
  LinkIcon,
  ListIcon,
  LockIcon,
  Settings2Icon,
  UploadIcon
} from 'lucide-react'
import { toast } from 'sonner'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import SearchableMenuSection from '@/features/nexacrm/components/ui/searchable-menu-section'
import { VIEW_BAR_TRIGGER } from '@/features/nexacrm/components/data-table/record-view-bar'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'

// Utils Imports
import { cn } from '@/features/nexacrm/lib/utils'
import { COPY_FAILED, COPY_FAILED_DESCRIPTION, copyText } from '@/features/nexacrm/utils/clipboard'

type SortableColumnItemProps<TData> = {
  column: Column<TData, unknown>
  disabled: boolean
}

const SortableColumnItem = <TData,>({ column, disabled }: SortableColumnItemProps<TData>) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
    disabled
  })

  const label = (column.columnDef.meta?.label as string | undefined) ?? column.id

  return (
    <DropdownMenuCheckboxItem
      ref={setNodeRef}
      checked={column.getIsVisible()}
      onCheckedChange={value => column.toggleVisibility(!!value)}
      className={cn('touch-none pl-1.5', isDragging && 'bg-muted/60 opacity-80')}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <span
        {...attributes}
        {...listeners}
        role='button'
        aria-label={`Reorder ${label}`}
        onClick={event => {
          event.preventDefault()
          event.stopPropagation()
        }}
        className={cn(
          'text-muted-foreground hover:text-foreground inline-flex size-5 shrink-0 items-center justify-center rounded-sm',
          disabled ? 'cursor-not-allowed opacity-40' : 'cursor-grab active:cursor-grabbing'
        )}
      >
        <GripVerticalIcon className='size-3.5' />
      </span>
      <span className='truncate'>{label}</span>
    </DropdownMenuCheckboxItem>
  )
}

type DataTableViewOptionsProps<TData> = {
  table: Table<TData>

  reorderableColumnIds?: string[]

  showSummary?: boolean
  onShowSummaryChange?: (next: boolean) => void

  onExport?: () => void
  exportLabel?: string

  onImport?: () => void
}

const DataTableViewOptions = <TData,>({
  table,
  reorderableColumnIds,
  showSummary,
  onShowSummaryChange,
  onExport,
  exportLabel = 'Export to CSV',
  onImport
}: DataTableViewOptionsProps<TData>) => {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const dndId = useId()

  const columnOrder = table.getState().columnOrder
  const hideableColumns = table.getAllLeafColumns().filter(column => column.getCanHide())

  const orderedColumns = columnOrder.length
    ? (columnOrder.map(id => hideableColumns.find(column => column.id === id)).filter(Boolean) as Column<
        TData,
        unknown
      >[])
    : hideableColumns

  const sortableIds = orderedColumns
    .filter(column => reorderableColumnIds?.includes(column.id))
    .map(column => column.id)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const order = [...columnOrder]
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))

    if (from < 0 || to < 0) return

    table.setColumnOrder(arrayMove(order, from, to))
  }

  const visibleCount = table.getVisibleLeafColumns().filter(column => column.getCanHide()).length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant='ghost' size='sm' className={VIEW_BAR_TRIGGER} />}>
        <Settings2Icon />
        <span className='max-sm:hidden'>Options</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-60'>
        <DropdownMenuGroup>
          <DropdownMenuItem disabled className='justify-between'>
            <span className='flex items-center gap-2'>
              <ListIcon /> Default View
            </span>
            <LockIcon className='size-3.5' />
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Columns3Icon />
              <span className='flex-1'>Fields</span>
              <span className='text-muted-foreground text-xs tabular-nums'>{visibleCount} shown</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className='w-60'>
              <SearchableMenuSection
                items={orderedColumns}
                getLabel={column => column.columnDef.meta?.label ?? column.id}
                label='fields'
              >
                {(columns, searching) => (
                  <DndContext
                    id={dndId}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    modifiers={[restrictToVerticalAxis]}
                    onDragEnd={searching ? undefined : handleDragEnd}
                  >
                    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                      {columns.map(column => (
                        <SortableColumnItem
                          key={column.id}
                          column={column}
                          disabled={searching || !sortableIds.includes(column.id)}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </SearchableMenuSection>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          {onShowSummaryChange ? (
            <DropdownMenuCheckboxItem
              checked={showSummary}
              onCheckedChange={value => onShowSummaryChange(value === true)}
            >
              Show summary row
            </DropdownMenuCheckboxItem>
          ) : null}

          <DropdownMenuItem
            onClick={async () => {
              if (await copyText(window.location.href)) toast.success('Link copied')
              else toast.error(COPY_FAILED, { description: COPY_FAILED_DESCRIPTION })
            }}
          >
            <LinkIcon /> Copy link to view
          </DropdownMenuItem>

          {onImport ? (
            <DropdownMenuItem onClick={onImport}>
              <UploadIcon /> Import from CSV
            </DropdownMenuItem>
          ) : null}

          {onExport ? (
            <DropdownMenuItem onClick={onExport}>
              <DownloadIcon /> {exportLabel}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default DataTableViewOptions
