'use client'
import { useState } from 'react'
import { Button } from '@/features/nexacrm/components/ui/button'
import type { CreatedUser } from '@/features/users/types'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import { useEmployeePermissions } from '../permissions'
import ProfileForm from './profile-form'
import CreateAccountForm from './create-account-form'

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
  const [createdAccount, setCreatedAccount] = useState<CreatedUser | null>(null)
  const [linkExisting, setLinkExisting] = useState(false)
  const { canCreate, canManageAccounts: canCreateAccount } = useEmployeePermissions()
  if (!canCreate) return null

  function changeOpen(next: boolean) {
    if (pending) return
    onOpenChange(next)
  }

  const showAccountForm = canCreateAccount && !linkExisting && !createdAccount
  let description = 'Choose an existing login account and add its employee details.'
  let step = 'Employee details'
  if (showAccountForm) {
    step = 'Step 1 of 2 · Login account'
    description = 'Create the employee’s login account, then add their work details.'
  } else if (createdAccount) {
    step = 'Step 2 of 2 · Employee details'
    description = 'The login account is saved. Complete the work profile below. You can close and resume this step.'
  }

  let form = null
  if (open && showAccountForm) {
    form = <CreateAccountForm onCancel={() => changeOpen(false)} onPendingChange={setPending} onCreated={setCreatedAccount} />
  } else if (open) {
    form = (
      <ProfileForm
        account={createdAccount || undefined}
        onCancel={() => changeOpen(false)}
        onPendingChange={setPending}
        onSaved={id => {
          setCreatedAccount(null)
          setLinkExisting(false)
          onOpenChange(false)
          onCreate(id)
        }}
      />
    )
  }

  let modeButtonLabel = 'Link existing account'
  if (linkExisting) modeButtonLabel = 'Create a new account instead'

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent
        className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"
        showCloseButton={!pending}
      >
        <DialogHeader>
          <DialogTitle>New employee</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs font-medium">{step}</p>
          {canCreateAccount && !createdAccount && (
            <Button type="button" variant="ghost" size="sm" disabled={pending}
              onClick={() => setLinkExisting(previous => !previous)}>{modeButtonLabel}</Button>
          )}
        </div>
        {!canCreateAccount && (
          <p className="text-muted-foreground text-xs">An administrator can create new login accounts. You can add profiles to existing accounts here.</p>
        )}
        {form}
      </DialogContent>
    </Dialog>
  )
}
