'use client'
import { useState } from 'react'
import { DownloadIcon, EllipsisVerticalIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import ConfirmDialog from '@/features/nexacrm/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/features/nexacrm/components/ui/dropdown-menu'
import { useCurrentUser } from '@/features/nexacrm/contexts/currentUserContext'
import { useEmployeesStore } from '../store'
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
  const remove = useEmployeesStore((state) => state.deleteEmployees)
  const { can } = useCurrentUser()
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
              <DownloadIcon />
              Export record
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {can('records:delete') && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2Icon />
                  Delete employee
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete employee"
        description={
          'Remove ' +
          employeeName(employee) +
          ' from the demo directory? This does not change the separate CRM preview.'
        }
        confirmLabel="Delete"
        onConfirm={() => {
          remove([employee.id])
          onDelete()
        }}
      />
    </>
  )
}
