'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import { useEmployeePermissions } from '../permissions'
import type { Employee } from '../types'
import ProfileForm from './profile-form'

export default function EditEmployeeDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [pending, setPending] = useState(false)
  const { canUpdate } = useEmployeePermissions()
  if (!canUpdate) return null

  function changeOpen(next: boolean) {
    if (pending) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>Edit employee</DialogTitle>
          <DialogDescription>
            Update work details. Name, email, and account status are managed
            separately.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ProfileForm
            key={employee.id}
            employee={employee}
            onCancel={() => changeOpen(false)}
            onPendingChange={setPending}
            onSaved={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
