'use client'

import { useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { DialogFooter } from '@/features/nexacrm/components/ui/dialog'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'
import { useEmployeesStore } from '../store'
import type {
  Employee,
  EmployeeCreateInput,
  EmployeeProfileInput,
} from '../types'

type ProfileValues = {
  jobPosition: string
  department: string
  contact: string
  workingSchedule: string
  companyName: string
  workLocation: string
  managerId: string
  location: string
}

type ProfileFormProps = {
  employee?: Employee
  onCancel: () => void
  onSaved: (id: string) => void
  onPendingChange: (pending: boolean) => void
}

const profileFields: {
  name: keyof ProfileValues
  label: string
  required: boolean
  maxLength: number
}[] = [
  {
    name: 'jobPosition',
    label: 'Job position',
    required: true,
    maxLength: 120,
  },
  { name: 'department', label: 'Department', required: true, maxLength: 120 },
  { name: 'contact', label: 'Contact number', required: true, maxLength: 20 },
  {
    name: 'workingSchedule',
    label: 'Working schedule',
    required: true,
    maxLength: 60,
  },
  {
    name: 'companyName',
    label: 'Company name',
    required: true,
    maxLength: 160,
  },
  {
    name: 'workLocation',
    label: 'Work location',
    required: true,
    maxLength: 160,
  },
  {
    name: 'location',
    label: 'Location (optional)',
    required: false,
    maxLength: 160,
  },
]

function initialValues(employee?: Employee): ProfileValues {
  return {
    jobPosition: employee?.jobTitle ?? '',
    department: employee?.department ?? '',
    contact: employee?.phone ?? '',
    workingSchedule: employee?.workingSchedule ?? '',
    companyName: employee?.companyName ?? '',
    workLocation: employee?.workLocation ?? '',
    managerId: employee?.managerId ?? '',
    location: employee?.location ?? '',
  }
}

function buildProfileInput(values: ProfileValues): EmployeeProfileInput {
  let managerId: string | null = null
  let location: string | null = null
  if (values.managerId) managerId = values.managerId
  if (values.location.trim()) location = values.location.trim()

  return {
    jobPosition: values.jobPosition.trim(),
    department: values.department.trim(),
    contact: values.contact.trim(),
    workingSchedule: values.workingSchedule.trim(),
    companyName: values.companyName.trim(),
    workLocation: values.workLocation.trim(),
    managerId,
    location,
  }
}

/** Shared profile fields for creation and editing; account identity stays read-only. */
export default function ProfileForm({
  employee,
  onCancel,
  onSaved,
  onPendingChange,
}: ProfileFormProps) {
  const formId = useId()
  const [values, setValues] = useState(() => initialValues(employee))
  const [accountId, setAccountId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accounts = useEmployeesStore((state) => state.accounts)
  const managers = useEmployeesStore((state) => state.managers)
  const optionsLoading = useEmployeesStore((state) => state.optionsLoading)
  const optionsError = useEmployeesStore((state) => state.optionsError)
  const loadOptions = useEmployeesStore((state) => state.loadOptions)
  const addEmployee = useEmployeesStore((state) => state.addEmployee)
  const updateEmployee = useEmployeesStore((state) => state.updateEmployee)

  useEffect(() => {
    void loadOptions().catch(() => {
      // The store exposes the error beside the selectors, with a retry action.
    })
  }, [loadOptions])

  const accountOptions = accounts.map((account) => ({
    value: account.id,
    label: `${account.name || 'Not set'} (${account.email})`,
  }))
  const managerOptions = [
    { value: '', label: 'Not assigned' },
    ...managers
      .filter(
        (manager) => manager.id !== employee?.id && manager.id !== accountId,
      )
      .map((manager) => ({
        value: manager.id,
        label: `${manager.name || 'Not set'} (${manager.email})`,
      })),
  ]
  if (
    employee?.managerId &&
    !managerOptions.some((option) => option.value === employee.managerId)
  ) {
    managerOptions.push({
      value: employee.managerId,
      label: employee.managerName || 'Assigned manager',
    })
  }

  let submitLabel = 'Create employee'
  if (employee) submitLabel = 'Save changes'
  if (pending) submitLabel = 'Saving...'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending) return
    setError(null)

    if (!employee && !accountId) {
      setError('Select an existing account for this employee.')
      return
    }
    for (const field of profileFields) {
      if (field.required && !values[field.name].trim()) {
        setError(`${field.label} is required.`)
        return
      }
    }
    const contact = values.contact.trim()
    if (contact.length < 7 || !/^[0-9+()\-\s]+$/.test(contact)) {
      setError(
        'Contact number must be 7 to 20 characters and contain only digits, spaces, +, -, ( or ).',
      )
      return
    }

    setPending(true)
    onPendingChange(true)
    try {
      const profile = buildProfileInput(values)
      let savedId: string
      if (employee) {
        await updateEmployee(employee.id, profile)
        savedId = employee.id
      } else {
        const input: EmployeeCreateInput = { ...profile, userId: accountId }
        savedId = await addEmployee(input)
      }
      onSaved(savedId)
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message)
      else setError('The employee could not be saved. Please try again.')
    } finally {
      setPending(false)
      onPendingChange(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="space-y-4">
        {!employee && (
          <div className="grid gap-2">
            <Label htmlFor={`${formId}-account`}>Employee account</Label>
            <SearchableSelect
              id={`${formId}-account`}
              label="Employee account"
              searchable
              value={accountId}
              options={accountOptions}
              disabled={optionsLoading || Boolean(optionsError)}
              placeholder="Select an existing account"
              onChange={(id) => {
                setAccountId(id)
                if (values.managerId === id)
                  setValues((previous) => ({ ...previous, managerId: '' }))
              }}
            />
            {!optionsLoading && !optionsError && accounts.length === 0 && (
              <p className="text-muted-foreground text-xs">
                No eligible accounts. An account must already exist and must not
                have an employee profile.
              </p>
            )}
          </div>
        )}
        {optionsLoading && (
          <p
            role="status"
            className="text-muted-foreground flex items-center gap-2 text-xs"
          >
            <LoaderCircleIcon className="size-3.5 animate-spin" /> Loading
            account and manager options...
          </p>
        )}
        {optionsError && (
          <div
            role="alert"
            className="border-destructive/30 rounded-lg border p-3 text-sm"
          >
            <p className="text-destructive">{optionsError}</p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => void loadOptions().catch(() => {})}
            >
              Retry options
            </Button>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {profileFields.map((field) => (
            <div key={field.name} className="grid gap-2">
              <Label htmlFor={`${formId}-${field.name}`}>{field.label}</Label>
              <Input
                id={`${formId}-${field.name}`}
                required={field.required}
                maxLength={field.maxLength}
                value={values[field.name]}
                onChange={(event) =>
                  setValues((previous) => ({
                    ...previous,
                    [field.name]: event.target.value,
                  }))
                }
              />
            </div>
          ))}
          <div className="grid content-start gap-2">
            <Label htmlFor={`${formId}-manager`}>Manager (optional)</Label>
            <SearchableSelect
              id={`${formId}-manager`}
              label="Manager"
              searchable
              value={values.managerId}
              options={managerOptions}
              disabled={optionsLoading || Boolean(optionsError)}
              onChange={(managerId) =>
                setValues((previous) => ({ ...previous, managerId }))
              }
            />
          </div>
        </div>
      </fieldset>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={
            pending ||
            (!employee &&
              (!accountId || optionsLoading || Boolean(optionsError)))
          }
        >
          {pending && <LoaderCircleIcon className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
