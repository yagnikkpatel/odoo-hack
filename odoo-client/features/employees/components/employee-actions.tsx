'use client'

import { useState } from 'react'
import {
  DownloadIcon,
  EllipsisVerticalIcon,
  LoaderCircleIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/nexacrm/components/ui/dropdown-menu'
import { useEmployeesStore } from '../store'
import { useEmployeePermissions } from '../permissions'
import { employeeName } from '../types'
import type { Employee } from '../types'
import { downloadEmployeesCsv } from '../csv'

export default function EmployeeActions({
  employee,
  onDelete,
}: {
  employee: Employee
  onDelete: () => void
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const remove = useEmployeesStore((state) => state.deleteEmployees)
  const { canDelete } = useEmployeePermissions()

  function changeOpen(open: boolean) {
    if (pending) return
    setConfirmOpen(open)
    setError(null)
  }

  async function confirmDelete() {
    if (pending || !canDelete) return
    setPending(true)
    setError(null)
    try {
      await remove([employee.id])
      setConfirmOpen(false)
      onDelete()
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message)
      else setError('The employee could not be deleted. Please try again.')
    } finally {
      setPending(false)
    }
  }

  let confirmLabel = 'Delete employee'
  if (pending) confirmLabel = 'Deleting...'

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Employee actions"
              className="text-muted-foreground hover:text-foreground"
            />
          }
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => downloadEmployeesCsv([employee])}>
              <DownloadIcon /> Export record
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => changeOpen(true)}
                >
                  <Trash2Icon /> Delete employee
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={confirmOpen} onOpenChange={changeOpen}>
        <DialogContent className="sm:max-w-sm" showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>Delete employee</DialogTitle>
            <DialogDescription>
              Remove {employeeName(employee)} from the employee directory? Their
              login account will not be deleted.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => void confirmDelete()}
            >
              {pending && <LoaderCircleIcon className="size-4 animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
