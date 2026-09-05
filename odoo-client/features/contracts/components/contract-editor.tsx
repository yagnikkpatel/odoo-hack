'use client'
import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
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
import { Choice } from '@/features/hr/components/form'
import { useEmployeesStore } from '@/features/employees/store'
import { employeeName } from '@/features/employees/types'
import { useContractsStore } from '../store'
import { CONTRACT_STATES, CURRENCIES, WAGE_PERIODS, today } from '../types'
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
// Mount only while open: every opening starts a fresh draft, and Cancel never writes a record.
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
  const employees = useEmployeesStore((state) => state.employees)
  const initialEmployee = employees.find(
    (employee) => employee.id === employeeId,
  )
  const [draft, setDraft] = useState<ContractInput>(() =>
    contract
      ? { ...contract }
      : {
          name: '',
          employeeId: initialEmployee?.id || '',
          startDate: today(),
          endDate: '',
          department: initialEmployee?.department || '',
          jobPosition: initialEmployee?.jobTitle || '',
          wage: 0,
          currency: 'INR',
          wagePeriod: 'month',
          salaryStructure: '',
          workingSchedule: '',
          state: 'draft',
        },
  )
  const [wage, setWage] = useState(contract ? String(contract.wage) : '')
  const [error, setError] = useState<string | null>(null)
  const save = useContractsStore((state) => state.save)
  const set = (input: Partial<ContractInput>) => {
    setDraft((current) => ({ ...current, ...input }))
    setError(null)
  }
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = save(
      { ...draft, wage: wage.trim() ? Number(wage) : Number.NaN },
      contract?.id,
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSaved(result.id)
    onClose()
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden pb-0 sm:max-w-xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>
            {contract ? 'Edit contract' : 'New contract'}
          </DialogTitle>
          <DialogDescription>
            Employment terms for one employee. Nothing is saved until you
            submit.
          </DialogDescription>
        </DialogHeader>
        <form className="flex min-h-0 flex-col gap-4" onSubmit={submit}>
          <div className="-mx-1 min-h-0 space-y-5 overflow-y-auto px-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Contract name" id="contract-name">
                <Input
                  id="contract-name"
                  required
                  value={draft.name}
                  onChange={(event) => set({ name: event.target.value })}
                  placeholder="Employment agreement"
                />
              </Field>
              <Field label="Employee" id="contract-employee">
                <Choice
                  id="contract-employee"
                  value={draft.employeeId}
                  options={employees.map((employee) => ({
                    value: employee.id,
                    label: employeeName(employee),
                  }))}
                  onChange={(employeeId) => {
                    const employee = employees.find(
                      (item) => item.id === employeeId,
                    )
                    set({
                      employeeId,
                      department: employee?.department || draft.department,
                      jobPosition: employee?.jobTitle || draft.jobPosition,
                    })
                  }}
                />
              </Field>
              <Field label="Start date" id="contract-start">
                <Input
                  id="contract-start"
                  required
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => set({ startDate: event.target.value })}
                />
              </Field>
              <Field label="End date (optional)" id="contract-end">
                <Input
                  id="contract-end"
                  type="date"
                  min={draft.startDate}
                  value={draft.endDate || ''}
                  onChange={(event) => set({ endDate: event.target.value })}
                />
              </Field>
              <Field label="Department" id="contract-department">
                <Input
                  id="contract-department"
                  required
                  value={draft.department}
                  onChange={(event) => set({ department: event.target.value })}
                />
              </Field>
              <Field label="Job position" id="contract-position">
                <Input
                  id="contract-position"
                  required
                  value={draft.jobPosition}
                  onChange={(event) => set({ jobPosition: event.target.value })}
                />
              </Field>
            </div>
            <div className="space-y-4 border-t pt-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Wage" id="contract-wage">
                  <Input
                    id="contract-wage"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={wage}
                    onChange={(event) => {
                      setWage(event.target.value)
                      setError(null)
                    }}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Currency" id="contract-currency">
                  <Choice
                    id="contract-currency"
                    value={draft.currency}
                    options={CURRENCIES.map((value) => ({
                      value,
                      label: value,
                    }))}
                    onChange={(currency) =>
                      set({ currency: currency as ContractInput['currency'] })
                    }
                  />
                </Field>
                <Field label="Wage period" id="contract-period">
                  <Choice
                    id="contract-period"
                    value={draft.wagePeriod}
                    options={Object.entries(WAGE_PERIODS).map(
                      ([value, label]) => ({ value, label }),
                    )}
                    onChange={(wagePeriod) =>
                      set({
                        wagePeriod: wagePeriod as ContractInput['wagePeriod'],
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Salary structure" id="contract-structure">
                  <Input
                    id="contract-structure"
                    required
                    value={draft.salaryStructure}
                    onChange={(event) =>
                      set({ salaryStructure: event.target.value })
                    }
                    placeholder="Regular salary"
                  />
                </Field>
                <Field
                  label="Working schedule (optional)"
                  id="contract-schedule"
                >
                  <Input
                    id="contract-schedule"
                    value={draft.workingSchedule || ''}
                    onChange={(event) =>
                      set({ workingSchedule: event.target.value })
                    }
                    placeholder="Standard working week"
                  />
                </Field>
              </div>
              <p className="text-muted-foreground text-xs">
                Structure and schedule names are preview fields until their
                setup modules are connected.
              </p>
              <Field label="Status" id="contract-status">
                <Choice
                  id="contract-status"
                  value={draft.state}
                  options={Object.entries(CONTRACT_STATES).map(
                    ([value, label]) => ({ value, label }),
                  )}
                  onChange={(state) =>
                    set({ state: state as ContractInput['state'] })
                  }
                />
              </Field>
              <p className="text-muted-foreground text-xs">
                Active contracts appear as Scheduled before their start date and
                Expired after their end date. Leave the end date empty for an
                ongoing contract.
              </p>
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="border-destructive/20 bg-destructive/5 text-destructive shrink-0 rounded-lg border p-3 text-sm"
            >
              {error}
            </p>
          )}
          <DialogFooter className="mb-0 shrink-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {contract ? 'Save changes' : 'Create contract'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
