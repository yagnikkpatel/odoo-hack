'use client'

import { useActionState, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'
import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/features/nexacrm/components/ui/dialog'
import { Choice } from '@/features/hr/components/form'
import { employeeName } from '@/features/employees/types'
import type { Employee } from '@/features/employees/types'
import { listContractEmployees } from '../service'
import { useContractsStore } from '../store'
import { CONTRACT_STATUSES, today } from '../types'
import type { Contract, ContractInput } from '../types'

function Field({
  label,
  id,
  children,
}: {
  label: string
  id: string
  children: ReactNode
}) {
  return (
    <div className="grid min-w-0 gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}

function initialInput(contract?: Contract, employeeId?: string): ContractInput {
  if (contract) {
    return {
      employeeId: contract.employeeId,
      startDate: contract.startDate,
      endDate: contract.endDate,
      wage: contract.wage,
      status: contract.status,
    }
  }
  return {
    employeeId: employeeId || '',
    startDate: today(),
    endDate: '',
    wage: Number.NaN,
    status: 'running',
  }
}

export default function ContractEditor({
  contract,
  employeeId,
  onClose,
  onSaved,
}: {
  contract?: Contract
  employeeId?: string
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [draft, setDraft] = useState(() => initialInput(contract, employeeId))
  const [wage, setWage] = useState(contract ? String(contract.wage) : '')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [employeesLoading, setEmployeesLoading] = useState(!contract)
  const [employeeError, setEmployeeError] = useState<string | null>(null)
  const save = useContractsStore((state) => state.save)

  useEffect(() => {
    if (contract) return
    let active = true
    void listContractEmployees()
      .then((records) => {
        if (active) setEmployees(records)
      })
      .catch((cause) => {
        if (!active) return
        setEmployeeError(
          cause instanceof Error
            ? cause.message
            : 'Employees could not be loaded.',
        )
      })
      .finally(() => {
        if (active) setEmployeesLoading(false)
      })
    return () => {
      active = false
    }
  }, [contract])

  function set(input: Partial<ContractInput>) {
    setDraft((current) => ({ ...current, ...input }))
  }

  async function saveContract() {
    try {
      const id = await save(
        { ...draft, wage: wage.trim() ? Number(wage) : Number.NaN },
        contract?.id,
      )
      onSaved(id)
      onClose()
      return { error: null }
    } catch (cause) {
      return {
        error:
          cause instanceof Error
            ? cause.message
            : 'The contract could not be saved. Please try again.',
      }
    }
  }
  const [submitState, formAction, isPending] = useActionState(saveContract, {
    error: null,
  })

  const employeeOptions = employees.map((employee) => ({
    value: employee.id,
    label: `${employeeName(employee)} · ${employee.email}`,
  }))
  if (
    draft.employeeId &&
    !employeeOptions.some((option) => option.value === draft.employeeId)
  ) {
    employeeOptions.unshift({
      value: draft.employeeId,
      label: 'Selected employee',
    })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !isPending) onClose()
      }}
    >
      <DialogContent
        className="flex max-h-[90dvh] flex-col overflow-hidden pb-0 sm:max-w-xl"
        showCloseButton={!isPending}
      >
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {contract ? 'Edit contract' : 'New contract'}
          </DialogTitle>
          <DialogDescription>
            Add the employee, effective dates, wage, and backend contract
            status.
          </DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-col gap-4" action={formAction}>
          <div className="-mx-1 -my-1 min-h-0 space-y-5 overflow-y-auto px-1 py-1">
            <Field label="Employee" id="contract-employee">
              {contract ? (
                <Input
                  id="contract-employee"
                  value={`${contract.employeeName} · ${contract.employeeEmail}`}
                  disabled
                />
              ) : employeesLoading ? (
                <Button type="button" variant="outline" disabled>
                  <LoaderCircleIcon className="animate-spin" />
                  Loading employees…
                </Button>
              ) : (
                <Choice
                  id="contract-employee"
                  value={draft.employeeId}
                  options={employeeOptions}
                  onChange={(value) => set({ employeeId: value })}
                />
              )}
            </Field>
            {employeeError && (
              <p role="alert" className="text-destructive text-sm">
                {employeeError}
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date" id="contract-start">
                <DatePicker
                  id="contract-start"
                  label="Start date"
                  required
                  value={draft.startDate}
                  onChange={(value) => set({ startDate: value })}
                />
              </Field>
              <Field label="End date" id="contract-end">
                <DatePicker
                  id="contract-end"
                  label="End date"
                  required
                  min={draft.startDate}
                  value={draft.endDate}
                  onChange={(value) => set({ endDate: value })}
                />
              </Field>
              <Field label="Wage" id="contract-wage">
                <Input
                  id="contract-wage"
                  required
                  type="number"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  value={wage}
                  onChange={(event) => {
                    setWage(event.target.value)
                  }}
                  placeholder="0.00"
                />
              </Field>
              <Field label="Status" id="contract-status">
                <Choice
                  id="contract-status"
                  value={draft.status}
                  options={Object.entries(CONTRACT_STATUSES).map(
                    ([value, label]) => ({ value, label }),
                  )}
                  onChange={(value) =>
                    set({ status: value as ContractInput['status'] })
                  }
                />
              </Field>
            </div>
          </div>
          {submitState.error && (
            <p
              role="alert"
              className="border-destructive/20 bg-destructive/5 text-destructive shrink-0 rounded-lg border p-3 text-sm"
            >
              {submitState.error}
            </p>
          )}
          <DialogFooter className="mb-0 shrink-0">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <ContractSubmitButton
              editing={Boolean(contract)}
              disabled={
                employeesLoading || Boolean(employeeError) || !draft.employeeId
              }
            />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ContractSubmitButton({
  editing,
  disabled,
}: {
  editing: boolean
  disabled: boolean
}) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={disabled || pending}>
      {pending && <LoaderCircleIcon className="animate-spin" />}
      {pending ? 'Saving…' : editing ? 'Save changes' : 'Create contract'}
    </Button>
  )
}
