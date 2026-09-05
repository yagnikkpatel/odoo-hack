'use client'

// Third-party Imports
import type { Column } from '@tanstack/react-table'
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon, EyeOffIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/features/nexacrm/components/ui/dropdown-menu'

// Utils Imports
import { cn } from '@/features/nexacrm/lib/utils'

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>
  title: string
  align?: 'start' | 'end'
  className?: string
}

const DataTableColumnHeader = <TData, TValue>({
  column,
  title,
  align = 'start',
  className
}: DataTableColumnHeaderProps<TData, TValue>) => {
  const Icon = column.columnDef.meta?.icon

  const label = (
    <span className='flex min-w-0 items-center gap-1.5'>
      {Icon ? <Icon className='size-3.5 shrink-0 opacity-60' /> : null}
      <span className='truncate'>{title}</span>
    </span>
  )

  if (!column.getCanSort()) {
    return (
      <div className={cn('text-muted-foreground font-medium', align === 'end' && 'justify-end', 'flex', className)}>
        {label}
      </div>
    )
  }

  const sorted = column.getIsSorted()

  return (
    <div className={cn('flex items-center', align === 'end' && 'justify-end', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant='ghost' size='sm' className='text-muted-foreground -ml-2' />}>
          {label}
          {sorted === 'desc' ? (
            <ArrowDownIcon />
          ) : sorted === 'asc' ? (
            <ArrowUpIcon />
          ) : (
            <ChevronsUpDownIcon className='opacity-0 transition-opacity group-hover/button:opacity-100' />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align === 'end' ? 'end' : 'start'}>
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUpIcon /> Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDownIcon /> Desc
          </DropdownMenuItem>
          {column.getCanHide() ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOffIcon /> Hide
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default DataTableColumnHeader
