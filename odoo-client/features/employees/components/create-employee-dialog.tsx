'use client'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import { splitPersonName } from '@/features/nexacrm/types/apps/person-types'
import { useEmployeesStore } from '../store'

export default function CreateEmployeeDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (id: string) => void
}) {
  const add = useEmployeesStore((state) => state.addEmployee)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [position, setPosition] = useState('')
  const close = () => {
    onOpenChange(false)
    setName('')
    setEmail('')
    setPosition('')
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) return
    const id = add({
      ...splitPersonName(name),
      email: email.trim(),
      jobTitle: position.trim() || undefined,
    })
    close()
    onCreate(id)
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => (value ? onOpenChange(true) : close())}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New employee</DialogTitle>
          <DialogDescription>
            Add basic details. You can complete their work information in the
            profile.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="new-employee-name">Name</Label>
            <Input
              id="new-employee-name"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-employee-email">Work email</Label>
            <Input
              id="new-employee-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-employee-position">Job position</Label>
            <Input
              id="new-employee-position"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit">Create employee</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
