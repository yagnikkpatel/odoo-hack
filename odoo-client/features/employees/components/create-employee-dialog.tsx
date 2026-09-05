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
import ProfileForm from './profile-form'

export default function CreateEmployeeDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (id: string) => void
}) {
  const [pending, setPending] = useState(false)
  const { canCreate } = useEmployeePermissions()
  if (!canCreate) return null

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
          <DialogTitle>New employee</DialogTitle>
          <DialogDescription>
            Add a work profile to an existing account. Name, email, and account
            status are managed separately.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <ProfileForm
            onCancel={() => changeOpen(false)}
            onPendingChange={setPending}
            onSaved={(id) => {
              onOpenChange(false)
              onCreate(id)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
