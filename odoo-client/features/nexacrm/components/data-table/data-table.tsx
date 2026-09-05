'use client'

// React Imports
import { useId } from 'react'
import type { ReactNode } from 'react'

// Third-party Imports
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { flexRender } from '@tanstack/react-table'
import type { Table as TanstackTable } from '@tanstack/react-table'

// Component Imports
import { Skeleton } from '@/features/nexacrm/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/features/nexacrm/components/ui/table'
import DataTableHeaderCell from '@/features/nexacrm/components/data-table/data-table-header-cell'

// Utils Imports
import { cn } from '@/features/nexacrm/lib/utils'

const INTERACTIVE_SELECTOR = 'a,button,input,select,textarea,[role="checkbox"],[role="menuitem"]'

const SKELETON_ROW_COUNT = 8

const ROW_HOVER = 'hover:bg-accent cursor-pointer transition-colors'

const ROW_SELECTED = [
  'data-[state=selected]:bg-[color-mix(in_oklab,var(--foreground)_20%,transparent)]',
  'data-[state=selected]:hover:bg-[color-mix(in_oklab,var(--foreground)_30%,transparent)]',
  'dark:data-[state=selected]:bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)]',
  'dark:data-[state=selected]:hover:bg-[color-mix(in_oklab,var(--foreground)_14%,transparent)]'
].join(' ')

type DataTableProps<TData> = {
  table: TanstackTable<TData>
  emptyLabel?: string

  /** Rendered instead of `emptyLabel` when there are no rows - for a richer empty state. */
  emptyState?: ReactNode
  headerRowClassName?: string
  footer?: ReactNode

  /*
   * Absorbs slack in a filler row after the last record, for a card taller than its rows.
   *
   * ! CURRENTLY UNUSED. RESERVED FOR a bounded, inner-scrolling table where the card's height is
   * ! fixed and the app shell is not the scroller. Keep or delete alongside `stickyHeader` - the two
   * ! only make sense together.
   */
  fillHeight?: boolean

  /** Renders placeholder rows instead of the body. Keeps the header and column widths stable. */
  isLoading?: boolean

  /*
   * Pins the header (and footer) while the body scrolls inside a bounded card.
   *
   * ! CURRENTLY UNUSED, and it CANNOT work on a list page: sticky needs a scroll container to pin
   * ! against and a list page opens none - the app shell owns the only scroll region. RESERVED FOR
   * ! the same bounded-table case as `fillHeight`.
   */
  stickyHeader?: boolean

  reorderableColumnIds?: string[]

  onRowClick?: (row: TData) => void
}

const DataTable = <TData,>({
  table,
  emptyLabel = 'No results.',
  emptyState,
  headerRowClassName,
  footer,
  fillHeight,
  isLoading,
  stickyHeader,
  reorderableColumnIds,
  onRowClick
}: DataTableProps<TData>) => {
  const colSpan = table.getVisibleLeafColumns().length
  const canReorder = Boolean(reorderableColumnIds?.length)
  const isResizable = table.getAllLeafColumns().some(column => column.getCanResize())
  const dndId = useId()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (!over || active.id === over.id) return

    const order = [...table.getState().columnOrder]
    const from = order.indexOf(String(active.id))
    const to = order.indexOf(String(over.id))

    if (from < 0 || to < 0) return

    table.setColumnOrder(arrayMove(order, from, to))
  }

  const headerCells = (headers: ReturnType<typeof table.getHeaderGroups>[number]['headers']) =>
    headers.map(header => (
      <DataTableHeaderCell
        key={header.id}
        header={header}
        reorderable={canReorder && reorderableColumnIds!.includes(header.column.id)}
      />
    ))

  const fillerRow =
    fillHeight && !isLoading && table.getRowModel().rows.length ? (
      <TableRow aria-hidden className='h-full hover:bg-transparent'>
        <TableCell colSpan={colSpan} className='border-r-0 p-0' />
      </TableRow>
    ) : null

  const tableContent = (
    <Table className={cn(isResizable && 'table-fixed', fillHeight && 'h-full')}>
      <TableHeader className={cn(stickyHeader && 'bg-card sticky top-0 z-20')}>
        {table.getHeaderGroups().map(headerGroup => (
          <TableRow key={headerGroup.id} className={cn('hover:bg-transparent', headerRowClassName)}>
            {canReorder ? (
              <SortableContext items={reorderableColumnIds!} strategy={horizontalListSortingStrategy}>
                {headerCells(headerGroup.headers)}
              </SortableContext>
            ) : (
              headerCells(headerGroup.headers)
            )}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {isLoading ? (
          Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
            <TableRow key={`skeleton-${index}`} className='hover:bg-transparent'>
              {table.getVisibleLeafColumns().map(column => (
                <TableCell
                  key={column.id}
                  style={{ width: column.getSize() }}
                  className={cn('border-r px-3 py-2 last:border-r-0', column.columnDef.meta?.cellClassName)}
                >
                  <Skeleton className='h-5 w-full' />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : table.getRowModel().rows.length ? (
          table.getRowModel().rows.map(row => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() ? 'selected' : undefined}
              className={cn('group/row', ROW_SELECTED, onRowClick && ROW_HOVER)}
              onClick={
                onRowClick
                  ? event => {
                      if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return

                      onRowClick(row.original)
                    }
                  : undefined
              }
            >
              {row.getVisibleCells().map(cell => (
                <TableCell
                  key={cell.id}
                  style={{ width: cell.column.getSize() }}
                  className={cn(
                    'truncate border-r px-3 py-2 last:border-r-0',
                    cell.column.columnDef.meta?.cellClassName
                  )}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : (
          <TableRow className='hover:bg-transparent'>
            <TableCell colSpan={colSpan} className='text-muted-foreground h-56 text-center'>
              {emptyState ?? emptyLabel}
            </TableCell>
          </TableRow>
        )}
        {fillerRow}
      </TableBody>
      {footer}
    </Table>
  )

  if (!canReorder) return tableContent

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToHorizontalAxis]}
      onDragEnd={handleDragEnd}
    >
      {tableContent}
    </DndContext>
  )
}

export default DataTable
