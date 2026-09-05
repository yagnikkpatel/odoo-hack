'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/features/nexacrm/components/ui/button'
import { Input } from '@/features/nexacrm/components/ui/input'
import { Checkbox } from '@/features/nexacrm/components/ui/checkbox'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import { Badge } from '@/features/nexacrm/components/ui/badge'
import { Choice, EditorDialog, FormField } from '@/features/hr/components/form'
import { listEligibleEmployees } from '../service'
import { usePayrollStore } from '../store'
import { EMPLOYMENT_TYPES, formatPeriod, money } from '../types'
import type { EligibleEmployee } from '../types'

function monthRange(offset = 0) {
  const now = new Date()
  const first = new Date(Date.UTC(now.getFullYear(), now.getMonth() + offset, 1))
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
  return { startDate: first.toISOString().slice(0, 10), endDate: last.toISOString().slice(0, 10) }
}
const monthLabel = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/**
 * Two steps, as the spec requires: scope and period first, then an explicit
 * employee selection. Nothing is created until "Create payrun" on step 2.
 */
export default function PayrunWizard({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const structures = usePayrollStore(state => state.structures.filter(item => item.active))
  const current = monthRange()
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState(`${monthLabel(current.startDate)} payroll`)
  const [structureId, setStructureId] = useState(structures[0]?.id ?? '')
  const [startDate, setStartDate] = useState(current.startDate)
  const [endDate, setEndDate] = useState(current.endDate)
  const [eligibility, setEligibility] = useState<{ key: string; rows: EligibleEmployee[]; error: string | null } | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [department, setDepartment] = useState('all')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const structure = structures.find(item => item.id === structureId)
  const scopeKey = step === 2 && structureId ? `${structureId}|${startDate}|${endDate}` : ''
  const eligible = useMemo(
    () => (eligibility?.key === scopeKey ? eligibility.rows : []),
    [eligibility, scopeKey]
  )
  const loading = Boolean(scopeKey) && eligibility?.key !== scopeKey

  useEffect(() => {
    if (!scopeKey) return
    const controller = new AbortController()
    listEligibleEmployees(structureId, startDate, endDate, controller.signal)
      .then(rows => {
        setEligibility({ key: scopeKey, rows, error: null })
        // Employees whose contract already names this structure are preselected.
        setSelected(rows.filter(row => row.structureMatches && !row.existingPayslipId).map(row => row.employeeId))
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setEligibility({
          key: scopeKey,
          rows: [],
          error: cause instanceof Error ? cause.message : 'Unable to load eligible employees.'
        })
      })
    return () => controller.abort()
  }, [scopeKey, structureId, startDate, endDate])

  const departments = useMemo(() => [...new Set(eligible.map(row => row.department).filter(Boolean))].sort(), [eligible])
  const visible = eligible.filter(
    row =>
      (department === 'all' || row.department === department) &&
      `${row.name} ${row.email} ${row.jobPosition}`.toLowerCase().includes(search.toLowerCase())
  )
  const allVisibleSelected = visible.length > 0 && visible.every(row => selected.includes(row.employeeId))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (!name.trim() || !structure || !startDate || !endDate || endDate < startDate) {
      setError('Enter a name, choose an active salary structure and a valid payroll period.')
      return
    }
    if (step === 1) {
      setStep(2)
      return
    }
    if (!selected.length) {
      setError('Select at least one employee.')
      return
    }
    setPending(true)
    const result = await usePayrollStore.getState().createPayrun({ name: name.trim(), structureId, startDate, endDate, employeeIds: selected })
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onClose()
    router.push(`/payroll/${result.id}`)
  }

  return (
    <EditorDialog
      title='New payrun'
      description={
        step === 1
          ? 'Step 1 of 2 · Choose the salary structure and payroll period.'
          : 'Step 2 of 2 · Select the employees to include in this batch.'
      }
      submitLabel={step === 1 ? 'Continue' : pending ? 'Creating…' : 'Create payrun'}
      pending={pending}
      onClose={onClose}
      onSubmit={submit}
      error={error ?? (eligibility?.key === scopeKey ? eligibility.error : null)}
    >
      {step === 1 ? (
        <>
          <FormField id='run-name' label='Run name'>
            <Input id='run-name' value={name} onChange={event => setName(event.target.value)} required maxLength={120} />
          </FormField>
          <FormField id='run-structure' label='Salary structure'>
            <Choice
              id='run-structure'
              value={structureId}
              placeholder='Choose a structure'
              options={structures.map(item => ({ value: item.id, label: `${item.name} · ${item.ruleCount} rules` }))}
              onChange={setStructureId}
            />
          </FormField>
          <div className='grid grid-cols-2 gap-4'>
            <FormField id='run-start' label='Period start'>
              <DatePicker
                id='run-start'
                value={startDate}
                required
                onChange={value => {
                  setStartDate(value)
                  if (endDate < value) setEndDate(value)
                }}
              />
            </FormField>
            <FormField id='run-end' label='Period end'>
              <DatePicker id='run-end' value={endDate} min={startDate} onChange={setEndDate} required />
            </FormField>
          </div>
          <div className='flex flex-wrap gap-2'>
            {[-1, 0].map(offset => {
              const range = monthRange(offset)
              return (
                <Button
                  key={offset}
                  type='button'
                  size='sm'
                  variant={range.startDate === startDate && range.endDate === endDate ? 'secondary' : 'outline'}
                  onClick={() => {
                    setStartDate(range.startDate)
                    setEndDate(range.endDate)
                    setName(`${monthLabel(range.startDate)} payroll`)
                  }}
                >
                  {monthLabel(range.startDate)}
                </Button>
              )
            })}
          </div>
          <p className='text-muted-foreground text-xs'>
            Continue lists employees with a single contract covering the whole period. The payrun is created only after
            you confirm the selection.
          </p>
        </>
      ) : (
        <>
          <div className='bg-muted/40 flex items-center justify-between gap-2 rounded-lg border p-3 text-sm'>
            <span>
              {structure?.name}
              <span className='text-muted-foreground block text-xs'>{formatPeriod(startDate, endDate)}</span>
            </span>
            <Button type='button' size='sm' variant='outline' onClick={() => setStep(1)}>
              Edit scope
            </Button>
          </div>
          <div className='grid gap-3 sm:grid-cols-[1fr_12rem]'>
            <Input
              aria-label='Search eligible employees'
              placeholder='Search employees…'
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <Choice
              id='run-department'
              value={department}
              options={[{ value: 'all', label: 'All departments' }, ...departments.map(value => ({ value, label: value }))]}
              onChange={setDepartment}
            />
          </div>
          <div className='text-muted-foreground flex items-center justify-between text-xs'>
            <span>
              {selected.length} selected · {eligible.length} eligible
            </span>
            <Button
              variant='ghost'
              size='sm'
              type='button'
              disabled={!visible.length}
              onClick={() =>
                setSelected(
                  allVisibleSelected
                    ? selected.filter(id => !visible.some(row => row.employeeId === id))
                    : [...new Set([...selected, ...visible.map(row => row.employeeId)])]
                )
              }
            >
              {allVisibleSelected ? 'Clear visible' : 'Select visible'}
            </Button>
          </div>
          <div className='max-h-72 overflow-auto rounded-lg border'>
            {loading && (
              <p className='text-muted-foreground flex items-center gap-2 p-4 text-sm'>
                <LoaderCircleIcon className='size-4 animate-spin' /> Checking contracts for this period…
              </p>
            )}
            {!loading &&
              visible.map(row => (
                <label
                  key={row.employeeId}
                  className='hover:bg-muted/40 flex cursor-pointer items-center gap-3 border-b p-3 last:border-0'
                >
                  <Checkbox
                    checked={selected.includes(row.employeeId)}
                    onCheckedChange={checked =>
                      setSelected(checked ? [...selected, row.employeeId] : selected.filter(id => id !== row.employeeId))
                    }
                  />
                  <span className='min-w-0 flex-1 text-sm'>
                    <span className='flex flex-wrap items-center gap-2'>
                      <span className='font-medium'>{row.name}</span>
                      {!row.structureMatches && (
                        <Badge variant='outline' className='text-xs'>
                          {row.contractStructureName ? `Contract: ${row.contractStructureName}` : 'No structure on contract'}
                        </Badge>
                      )}
                      {row.existingPayslipId && (
                        <Badge variant='outline' className='border-amber-200 text-xs text-amber-700'>
                          Has a payslip in this period
                        </Badge>
                      )}
                      {!row.hasBankDetails && (
                        <Badge variant='outline' className='border-rose-200 text-xs text-rose-700'>
                          No bank details
                        </Badge>
                      )}
                    </span>
                    <span className='text-muted-foreground block text-xs'>
                      {[row.department || 'No department', row.jobPosition, EMPLOYMENT_TYPES[row.employmentType]]
                        .filter(Boolean)
                        .join(' · ')}{' '}
                      · {money(row.wage)}/month
                    </span>
                  </span>
                </label>
              ))}
            {!loading && !visible.length && (
              <div className='text-muted-foreground p-6 text-center text-sm'>
                No eligible employees match this scope. Review the period, or{' '}
                <Link className='underline' href='/contracts'>
                  check employee contracts
                </Link>
                .
              </div>
            )}
          </div>
        </>
      )}
    </EditorDialog>
  )
}
