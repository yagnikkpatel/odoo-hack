'use client'

import { useState } from 'react'
import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import { useEmployeesStore } from '../store'
import { employeeName } from '../types'
import type { Employee } from '../types'

export default function EmployeeDeleteDialog({
  open,
  onOpenChange,
  employees,
  onDeleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  onDeleted?: () => void
}) {
  const remove = useEmployeesStore((state) => state.deleteEmployees)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState('')
  let title = 'Delete ' + employees.length + ' employees?'
  let description = 'Delete these employee profiles? Their user accounts will remain. This cannot be undone.'
  if (employees.length === 1) {
    title = 'Delete employee?'
    description = 'Delete the profile for ' + employeeName(employees[0]) + '? The user account will remain. This cannot be undone.'
  }

  function changeOpen(next: boolean) {
    if (isDeleting) return
    setError('')
    onOpenChange(next)
  }

  async function handleDelete() {
    if (isDeleting || employees.length === 0) return
    setIsDeleting(true)
    setError('')
    try {
      await remove(employees.map((employee) => employee.id))
      onDeleted?.()
      onOpenChange(false)
    } catch (cause) {
      let message = 'The employee profiles could not be deleted. Please try again.'
      if (cause instanceof Error) message = cause.message
      setError(message)
    } finally {
      setIsDeleting(false)
    }
  }

  let buttonLabel = 'Delete'
  if (isDeleting) buttonLabel = 'Deleting…'

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={!isDeleting}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
        <DialogFooter>
          <Button variant="outline" disabled={isDeleting} onClick={() => changeOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={isDeleting || employees.length === 0} onClick={handleDelete}>
            {isDeleting && <LoaderCircleIcon className="animate-spin" />}
            {buttonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
