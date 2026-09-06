'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { DialogFooter } from '@/features/nexacrm/components/ui/dialog'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Label } from '@/features/nexacrm/components/ui/label'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'
import { useEmployeesStore } from '../store'
import OfficeLocationSearch from './office-location-search'
import type {
  Employee,
  EmployeeAccount,
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
  account?: EmployeeAccount
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
  { name: 'location', label: 'Location', required: true, maxLength: 160 },
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
  return {
    jobPosition: values.jobPosition.trim(),
    department: values.department.trim(),
    contact: values.contact.trim(),
    workingSchedule: values.workingSchedule.trim(),
    companyName: values.companyName.trim(),
    workLocation: values.workLocation.trim(),
    managerId: values.managerId,
    location: values.location.trim(),
  }
}

/** Shared profile fields for creation and editing; account identity stays read-only. */
export default function ProfileForm({
  employee,
  account,
  onCancel,
  onSaved,
  onPendingChange,
}: ProfileFormProps) {
  const formId = useId()
  const [values, setValues] = useState(() => initialValues(employee))
  const [latitude, setLatitude] = useState(employee?.workLatitude?.toString() ?? '')
  const [longitude, setLongitude] = useState(employee?.workLongitude?.toString() ?? '')
  const [radius, setRadius] = useState(employee?.workRadiusM?.toString() ?? '150')
  const [locationEdited, setLocationEdited] = useState(false)
  const [manualLocation, setManualLocation] = useState(false)
  const [locationSearchPending, setLocationSearchPending] = useState(false)
  const showManualLocation = useCallback(() => setManualLocation(true), [])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const accountId = account?.id || selectedAccountId
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
  const managerOptions = managers
    .filter(
      (manager) => manager.id !== employee?.id && manager.id !== accountId,
    )
    .map((manager) => ({
      value: manager.id,
      label: `${manager.name || 'Not set'} (${manager.email})`,
    }))
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
    if (pending || locationSearchPending) return
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
    if (!values.managerId && (!employee || employee.managerId)) {
      setError('Manager is required.')
      return
    }
    const contact = values.contact.trim()
    if (contact.length < 7 || !/^[0-9+()\-\s]+$/.test(contact)) {
      setError(
        'Contact number must be 7 to 20 characters and contain only digits, spaces, +, -, ( or ).',
      )
      return
    }

    if (locationEdited) {
      if (!!latitude.trim() !== !!longitude.trim()) {
        setError('Enter both latitude and longitude, or leave both blank.')
        return
      }
      if ((latitude.trim() && (!Number.isFinite(Number(latitude)) || Math.abs(Number(latitude)) > 90)) ||
          (longitude.trim() && (!Number.isFinite(Number(longitude)) || Math.abs(Number(longitude)) > 180)) ||
          !Number.isInteger(Number(radius)) || Number(radius) < 10 || Number(radius) > 5000) {
        setError('Use latitude −90 to 90, longitude −180 to 180, and a whole-number distance from 10 to 5,000 metres.')
        return
      }
    }

    setPending(true)
    onPendingChange(true)
    try {
      const profile = buildProfileInput(values)
      if (locationEdited) {
        profile.workLatitude = latitude.trim() ? Number(latitude) : null
        profile.workLongitude = longitude.trim() ? Number(longitude) : null
        profile.workRadiusM = Number(radius)
      }
      let savedId: string
      if (employee) {
        // Existing assignments may predate the current manager-role rules.
        // Only validate/reassign the manager when the user changes it.
        const { managerId, ...workDetails } = profile
        await updateEmployee(employee.id, managerId === (employee.managerId ?? '')
          ? workDetails
          : profile)
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
    <form onSubmit={submit} className="min-w-0 space-y-4" aria-busy={pending}>
      <fieldset disabled={pending} className="min-w-0 space-y-4">
        {account && !employee && (
          <div className="bg-muted rounded-lg p-3 text-sm">
            <p className="font-medium">{account.name}</p>
            <p className="text-muted-foreground break-all">{account.email}</p>
            <p className="text-muted-foreground mt-2 text-xs">
              Account created. Finish this profile to add the employee to the directory.
              Retrying this step will not create another account.
            </p>
          </div>
        )}
        {!employee && !account && (
          <div className="grid min-w-0 gap-2">
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
                setSelectedAccountId(id)
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
            <div key={field.name} className="grid min-w-0 gap-2">
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
          <div className="grid min-w-0 content-start gap-2">
            <Label htmlFor={`${formId}-manager`}>Manager</Label>
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
        {employee && <div className="space-y-3 rounded-lg border p-3">
          <p className="text-sm font-medium">Office location for attendance</p>
          <p className="text-muted-foreground text-xs">Search for the office to fill its coordinates, then set the allowed distance.</p>
          <OfficeLocationSearch onFallback={showManualLocation} onPendingChange={setLocationSearchPending}
            onSelect={place => {
              setLatitude(String(place.latitude)); setLongitude(String(place.longitude)); setLocationEdited(true)
              setValues(previous => ({ ...previous, workLocation: place.name.slice(0, 160), location: (place.formattedAddress || place.name).slice(0, 160) }))
            }} />
          {latitude && longitude && <p className="text-xs text-muted-foreground">Coordinates: {latitude}, {longitude}</p>}
          <details open={manualLocation} onToggle={event => setManualLocation(event.currentTarget.open)}>
            <summary className="cursor-pointer text-sm">Manual coordinates</summary>
            <p className="my-2 text-xs text-muted-foreground">Use these if search is unavailable. Leave both blank to turn off the distance check.</p>
            <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-latitude`}>Latitude</Label>
              <Input id={`${formId}-latitude`} disabled={locationSearchPending} type="number" step="any" min={-90} max={90} placeholder="23.022505"
                value={latitude} onChange={event => { setLatitude(event.target.value); setLocationEdited(true) }} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-longitude`}>Longitude</Label>
              <Input id={`${formId}-longitude`} disabled={locationSearchPending} type="number" step="any" min={-180} max={180} placeholder="72.5713621"
                value={longitude} onChange={event => { setLongitude(event.target.value); setLocationEdited(true) }} />
            </div>
            </div>
          </details>
            <div className="grid gap-2">
              <Label htmlFor={`${formId}-radius`}>Allowed distance (metres)</Label>
              <Input id={`${formId}-radius`} type="number" step={1} min={10} max={5000} required={locationEdited}
                value={radius} onChange={event => { setRadius(event.target.value); setLocationEdited(true) }} />
            </div>
        </div>}
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
            pending || locationSearchPending ||
            (!employee && !accountId)
          }
        >
          {pending && <LoaderCircleIcon className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
