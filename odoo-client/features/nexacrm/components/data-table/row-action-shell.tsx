'use client'

// React Imports
import { useState } from 'react'
import type { ReactNode } from 'react'

// Next Imports
import Link from 'next/link'

// Third-party Imports
import { EyeIcon, MoreVerticalIcon, PencilIcon, Trash2Icon } from 'lucide-react'

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

type RowActionShellProps = {
  viewHref?: string
  onEdit?: () => void
  onDelete?: () => void
  label?: string
  deleteTitle?: string
  deleteDescription?: ReactNode

  extraItems?: ReactNode
}

const RowActionShell = ({
  viewHref,
  onEdit,
  onDelete,
  label = 'Row actions',
  deleteTitle = 'Delete record',
  deleteDescription,
  extraItems
}: RowActionShellProps) => {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className='flex items-center justify-center'>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              aria-label={label}
              className='text-muted-foreground hover:text-foreground'
            />
          }
        >
          <MoreVerticalIcon />
        </DropdownMenuTrigger>

        <DropdownMenuContent align='end' className='w-40'>
          <DropdownMenuGroup>
            {viewHref ? (
              <DropdownMenuItem render={<Link href={viewHref} />}>
                <EyeIcon /> View
              </DropdownMenuItem>
            ) : null}

            {onEdit ? (
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon /> Edit
              </DropdownMenuItem>
            ) : null}

            {extraItems}
          </DropdownMenuGroup>

          {onDelete ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem variant='destructive' onClick={() => setConfirmOpen(true)}>
                  <Trash2Icon /> Delete
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {onDelete ? (
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={deleteTitle}
          description={deleteDescription}
          confirmLabel='Delete'
          onConfirm={onDelete}
        />
      ) : null}
    </div>
  )
}

export default RowActionShell
