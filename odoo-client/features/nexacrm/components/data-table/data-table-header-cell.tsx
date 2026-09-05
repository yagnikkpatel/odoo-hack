'use client'

// Third-party Imports
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { flexRender } from '@tanstack/react-table'
import type { Header } from '@tanstack/react-table'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import { TableHead } from '@/features/nexacrm/components/ui/table'

// Utils Imports
import { cn } from '@/features/nexacrm/lib/utils'

type DataTableHeaderCellProps<TData, TValue> = {
  header: Header<TData, TValue>
  reorderable?: boolean
  className?: string
}

const DataTableHeaderCell = <TData, TValue>({
  header,
  reorderable = false,
  className
}: DataTableHeaderCellProps<TData, TValue>) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useSortable({
    id: header.column.id,
    disabled: !reorderable
  })

  const label = (header.column.columnDef.meta?.label as string | undefined) ?? header.column.id
  const canResize = header.column.getCanResize()

  return (
    <TableHead
      ref={reorderable ? setNodeRef : undefined}
      colSpan={header.colSpan}
      style={{
        width: header.getSize(),

        transform: transform ? CSS.Translate.toString({ ...transform, y: 0 }) : undefined
      }}
      className={cn(
        'group/head relative px-3',
        header.column.columnDef.meta?.cellClassName,
        isDragging && 'bg-muted z-10 opacity-90',
        className
      )}
    >
      {header.isPlaceholder ? null : reorderable ? (
        <div
          {...attributes}
          {...listeners}
          className='flex min-w-0 cursor-grab touch-none items-center select-none active:cursor-grabbing'
        >
          {flexRender(header.column.columnDef.header, header.getContext())}
        </div>
      ) : (
        flexRender(header.column.columnDef.header, header.getContext())
      )}

      {canResize ? (
        <Button
          variant='ghost'
          aria-label={`Resize ${label} column`}
          onPointerDown={header.getResizeHandler()}
          onDoubleClick={() => header.column.resetSize()}
          className={cn(
            'hover:bg-primary/40 absolute top-0 right-0 h-full w-1.5 min-w-0 cursor-col-resize touch-none rounded-none p-0 opacity-0 transition-opacity group-hover/head:opacity-100 active:translate-y-0',
            header.column.getIsResizing() && 'bg-primary/60 opacity-100'
          )}
        />
      ) : null}
    </TableHead>
  )
}

export default DataTableHeaderCell
