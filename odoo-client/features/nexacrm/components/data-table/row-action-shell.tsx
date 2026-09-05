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
  onDelete?: () => void | Promise<void>
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
  const [deleting, setDeleting] = useState(false)

  // onDelete may be async, so hold the in-flight state here and let the dialog block
  // a second confirm until it settles.
  const handleDelete = async () => {
    if (!onDelete) return

    setDeleting(true)

    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  // With no view/edit/extra entries the leading group and its separator would render as
  // dead space above a lone Delete, so both are dropped when there is nothing above it.
  const leadingItems = viewHref || onEdit || extraItems ? (
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
  ) : null

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
          {leadingItems}

          {onDelete ? (
            <>
              {leadingItems ? <DropdownMenuSeparator /> : null}
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
          pending={deleting}
          onConfirm={handleDelete}
        />
      ) : null}
    </div>
  )
}

export default RowActionShell
