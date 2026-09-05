'use client'

import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { DialogFooter } from '@/features/nexacrm/components/ui/dialog'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'
import { createUser } from '@/features/users/service'
import { USER_ROLE_OPTIONS } from '@/features/users/types'
import type { CreatedUser, UserRole } from '@/features/users/types'

export default function CreateAccountForm({ onCreated, onCancel, onPendingChange }: {
  onCreated: (user: CreatedUser) => void
  onCancel: () => void
  onPendingChange: (pending: boolean) => void
}) {
  const id = useId()
  const submitting = useRef(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('employee')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return
    if (!name.trim()) {
      setError('Enter the employee’s name.')
      return
    }
    submitting.current = true
    setPending(true)
    onPendingChange(true)
    setError(null)
    try {
      const user = await createUser({ name, email, password, role })
      setPassword('')
      onCreated(user)
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message)
      else setError('The account could not be created. Please try again.')
    } finally {
      submitting.current = false
      setPending(false)
      onPendingChange(false)
    }
  }

  let submitLabel = 'Create account & continue'
  if (pending) submitLabel = 'Creating account...'

  return (
    <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>Name</Label>
          <Input id={`${id}-name`} required maxLength={120} autoComplete="name" value={name}
            onChange={event => setName(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-email`}>Work email</Label>
          <Input id={`${id}-email`} type="email" required maxLength={254} autoComplete="email" value={email}
            onChange={event => setEmail(event.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-password`}>Initial password</Label>
          <Input id={`${id}-password`} type="password" required minLength={8} maxLength={72} autoComplete="new-password"
            value={password} onChange={event => setPassword(event.target.value)} />
          <p className="text-muted-foreground text-xs">8–72 characters. Share these login details securely; no invitation email is sent.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${id}-role`}>Role</Label>
          <SearchableSelect id={`${id}-role`} label="Role" value={role} options={USER_ROLE_OPTIONS} disabled={pending}
            onChange={value => setRole(value as UserRole)} />
        </div>
      </fieldset>
      {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" disabled={pending} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>{submitLabel}</Button>
      </DialogFooter>
    </form>
  )
}
