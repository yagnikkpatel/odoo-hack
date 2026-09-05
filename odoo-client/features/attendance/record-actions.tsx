'use client'

import { useActionState, useState } from 'react'
import Link from 'next/link'
import {
  EllipsisVerticalIcon,
  EyeIcon,
  LoaderCircleIcon,
  PencilIcon,
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
  DropdownMenuTrigger,
} from '@/features/nexacrm/components/ui/dropdown-menu'
import { useAttendancePermissions } from './permissions'
import { useAttendanceStore } from './store'
import type { Attendance } from './types'

export default function AttendanceActions({
  record,
  onEdit,
  onDeleted,
  detail = false,
}: {
  record: Attendance
  onEdit: () => void
  onDeleted?: () => void
  detail?: boolean
}) {
  const { canUpdate, canDelete } = useAttendancePermissions()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const remove = useAttendanceStore((state) => state.remove)
  const [result, deleteAction, pending] = useActionState(
    async () => {
      if (!canDelete)
        return { error: 'You do not have permission to delete attendance.' }
      try {
        await remove(record.id)
        setConfirmOpen(false)
        onDeleted?.()
        return { error: null }
      } catch (cause) {
        return {
          error:
            cause instanceof Error
              ? cause.message
              : 'Attendance could not be deleted. Please try again.',
        }
      }
    },
    { error: null },
  )

  if (detail && !canUpdate && !canDelete) return null

  return (
    <div className="flex items-center gap-1">
      {detail && canUpdate && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          Correct attendance
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Attendance actions for ${record.employeeName}`}
            />
          }
        >
          <EllipsisVerticalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {!detail && (
              <DropdownMenuItem
                render={<Link href={'/attendance/' + record.id} />}
              >
                <EyeIcon />
                View
              </DropdownMenuItem>
            )}
            {canUpdate && (
              <DropdownMenuItem onClick={onEdit}>
                <PencilIcon />
                Correct attendance
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2Icon />
                Delete attendance
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {canDelete && (
        <Dialog
          open={confirmOpen}
          onOpenChange={(open) => {
            if (!pending) setConfirmOpen(open)
          }}
        >
          <DialogContent className="sm:max-w-sm" showCloseButton={!pending}>
            <DialogHeader>
              <DialogTitle>Delete attendance?</DialogTitle>
              <DialogDescription>
                Permanently delete {record.employeeName}’s attendance for{' '}
                {record.attendanceDate}?
              </DialogDescription>
            </DialogHeader>
            <form action={deleteAction} className="space-y-4">
              {result.error && (
                <p role="alert" className="text-destructive text-sm">
                  {result.error}
                </p>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                  {pending && <LoaderCircleIcon className="animate-spin" />}
                  {pending ? 'Deleting…' : 'Delete attendance'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
