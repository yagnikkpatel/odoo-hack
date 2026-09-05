'use client'

// React Imports
import type { ReactNode } from 'react'

// Third-party Imports
import type { Table } from '@tanstack/react-table'
import { XIcon } from 'lucide-react'

// Component Imports
import { Button } from '@/features/nexacrm/components/ui/button'

type BulkActionBarProps<TData> = {
  table: Table<TData>
  children?: ReactNode
}

const BulkActionBar = <TData,>({ table, children }: BulkActionBarProps<TData>) => {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length

  if (selectedCount === 0) return null

  return (
    <div className='bg-muted/40 flex items-center gap-2 px-3 py-2'>
      <Button variant='ghost' size='icon-sm' aria-label='Clear selection' onClick={() => table.resetRowSelection()}>
        <XIcon />
      </Button>
      <span className='text-sm font-medium'>{selectedCount} selected</span>
      <div className='ml-auto flex items-center gap-2'>{children}</div>
    </div>
  )
}

export default BulkActionBar
