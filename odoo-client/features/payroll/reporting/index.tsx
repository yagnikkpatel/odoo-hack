'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangleIcon,
  BarChart3Icon,
  CalendarCheckIcon,
  ClockIcon,
  FileTextIcon,
  LoaderCircleIcon,
  UsersIcon,
  WalletIcon
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/nexacrm/components/ui/card'
import { Button } from '@/features/nexacrm/components/ui/button'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import { Skeleton } from '@/features/nexacrm/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/features/nexacrm/components/ui/chart'
import { Choice } from '@/features/hr/components/form'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { usePayrollPermissions } from '../permissions'
import { loadDashboard } from '../service'
import { EMPLOYMENT_TYPES, PAYRUN_STATUSES, count, money } from '../types'
import type { DashboardFilters, PayrollDashboard } from '../types'
import { AccessDenied } from '../components/list-page'

const chartConfig = { net: { label: 'Net salary paid', color: 'var(--chart-1)' } }
const compactMoney = (value: number) =>
  value >= 100_000 ? `${(value / 100_000).toFixed(1)}L` : value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
const monthLabel = (month: string) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

export default function PayrollReports() {
  const permissions = usePayrollPermissions()
  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    from: `${today().slice(0, 7)}-01`,
    to: today(),
    department: '',
    employmentType: ''
  }))
  const [result, setResult] = useState<{ key: string; report: PayrollDashboard | null; error: string | null } | null>(null)
  const validPeriod = filters.from <= filters.to
  const filterKey = `${filters.from}|${filters.to}|${filters.department}|${filters.employmentType}`
  // The last report stays visible while the next filter combination loads.
  const report = result?.report ?? null
  const error = result?.key === filterKey ? result.error : null
  const loading = validPeriod && result?.key !== filterKey

  useEffect(() => {
    if (!permissions.canReport || !validPeriod) return
    const controller = new AbortController()
    loadDashboard(filters, controller.signal)
      .then(data => setResult({ key: filterKey, report: data, error: null }))
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        setResult(current => ({
          key: filterKey,
          report: current?.report ?? null,
          error: cause instanceof Error ? cause.message : 'Unable to load the payroll dashboard.'
        }))
      })
    return () => controller.abort()
  }, [filters, filterKey, permissions.canReport, validPeriod])

  const set = (patch: Partial<DashboardFilters>) => setFilters(current => ({ ...current, ...patch }))
  const departments = report?.filters.departments ?? []
  const costData = useMemo(() => report?.costByDepartment.filter(row => row.net > 0) ?? [], [report])
  const trendData = useMemo(() => report?.monthlyTrend.map(row => ({ ...row, label: monthLabel(row.month) })) ?? [], [report])

  if (!permissions.canReport) return <AccessDenied>Payroll reports are available to HR and payroll staff.</AccessDenied>
  return (
    <div className={PAGE_BODY}>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div>
          <h1 className='flex items-center gap-2 text-lg font-semibold'>
            <BarChart3Icon className='size-5' />
            Payroll dashboard
          </h1>
          <p className='text-muted-foreground mt-1 text-sm'>Live salary, attendance and leave figures for the selected filters.</p>
        </div>
        <div className='flex items-center gap-2'>
          {loading && <LoaderCircleIcon className='text-muted-foreground size-4 animate-spin' />}
          {permissions.canRead && (
            <Button variant='outline' size='sm' render={<Link href='/payroll' />}>
              View payruns
            </Button>
          )}
        </div>
      </div>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
        <Filter label='Period from' id='payroll-report-from'>
          <DatePicker id='payroll-report-from' value={filters.from} onChange={from => set({ from })} />
        </Filter>
        <Filter label='Period to' id='payroll-report-to'>
          <DatePicker id='payroll-report-to' value={filters.to} min={filters.from} onChange={to => set({ to })} />
        </Filter>
        <Filter label='Department' id='payroll-report-department'>
          <Choice
            id='payroll-report-department'
            value={filters.department || 'all'}
            options={[{ value: 'all', label: 'All departments' }, ...departments.map(value => ({ value, label: value }))]}
            onChange={value => set({ department: value === 'all' ? '' : value })}
          />
        </Filter>
        <Filter label='Employee type' id='payroll-report-type'>
          <Choice
            id='payroll-report-type'
            value={filters.employmentType || 'all'}
            options={[
              { value: 'all', label: 'All employee types' },
              ...Object.entries(EMPLOYMENT_TYPES).map(([value, label]) => ({ value, label }))
            ]}
            onChange={value => set({ employmentType: value === 'all' ? '' : value })}
          />
        </Filter>
      </div>
      {!validPeriod && (
        <p role='alert' className='text-destructive text-sm'>
          Choose a period whose end is on or after its start.
        </p>
      )}
      {error && (
        <p role='alert' className='text-destructive text-sm'>
          {error}
        </p>
      )}
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
        <Kpi title='Total net salary paid' value={report ? money(report.kpis.netPaid) : null} icon={WalletIcon} detail={report ? `${report.kpis.headcount} employees in scope` : ''} />
        <Kpi title='Payslips generated' value={report ? count(report.kpis.payslipsGenerated) : null} icon={FileTextIcon} detail='Overlapping the selected period' />
        <Kpi title='Average salary' value={report ? money(report.kpis.averageNet) : null} icon={UsersIcon} detail='Net paid per paid payslip' />
        <Kpi title='Approved time off' value={report ? `${count(report.kpis.approvedLeaveDays)} days` : null} icon={CalendarCheckIcon} detail={report ? `${count(report.timeOff.unpaidDays)} unpaid · ${report.timeOff.pendingRequests} pending` : ''} />
        <Kpi title='Attendance health' value={report ? (report.kpis.attendanceHealth === null ? 'No data' : `${report.kpis.attendanceHealth}%`) : null} icon={ClockIcon} detail={report ? `${report.attendance.coveredDays} of ${report.attendance.scheduledDays} scheduled days covered` : ''} />
      </div>
      <div className='grid gap-4 lg:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Salary cost by department</CardTitle>
            <CardDescription>Net salary paid in the period</CardDescription>
          </CardHeader>
          <CardContent>
            {costData.length ? (
              <ChartContainer config={chartConfig} className='h-64 w-full'>
                <BarChart data={costData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey='department' tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={value => compactMoney(Number(value))} />
                  <ChartTooltip content={<ChartTooltipContent formatter={value => money(Number(value))} />} />
                  <Bar dataKey='net' fill='var(--color-net)' radius={4} />
                </BarChart>
              </ChartContainer>
            ) : (
              <EmptyChart text='Mark a payrun as paid to see department salary costs.' />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Monthly net salary trend</CardTitle>
            <CardDescription>Paid payslips over the last twelve months</CardDescription>
          </CardHeader>
          <CardContent>
            {trendData.some(row => row.net > 0) ? (
              <ChartContainer config={chartConfig} className='h-64 w-full'>
                <LineChart data={trendData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey='label' tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                  <YAxis tickLine={false} axisLine={false} width={48} tickFormatter={value => compactMoney(Number(value))} />
                  <ChartTooltip content={<ChartTooltipContent formatter={value => money(Number(value))} />} />
                  <Line dataKey='net' stroke='var(--color-net)' strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ChartContainer>
            ) : (
              <EmptyChart text='Paid payroll history will appear here.' />
            )}
          </CardContent>
        </Card>
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        <Card>
          <CardHeader>
            <CardTitle>Attendance overview</CardTitle>
            <CardDescription>Scheduled Monday to Friday, up to today</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <Metric label='Present' value={report ? count(report.attendance.present) : '—'} />
            <Metric label='Late arrivals' value={report ? count(report.attendance.late) : '—'} />
            <Metric label='Absent' value={report ? count(report.attendance.absent) : '—'} />
            <Metric label='Overtime' value={report ? `${count(report.attendance.overtimeHours)} h` : '—'} />
            <Metric label='Missing check-outs' value={report ? count(report.attendance.missingCheckouts) : '—'} />
            <Metric label='Manually corrected' value={report ? count(report.attendance.manualEdits) : '—'} />
            <Metric label='Coverage' value={report ? (report.attendance.coverage === null ? 'No data' : `${report.attendance.coverage}%`) : '—'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Time off overview</CardTitle>
            <CardDescription>Approved leave within the period</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <Metric label='Approved leave' value={report ? `${count(report.timeOff.approvedDays)} days · ${count(report.timeOff.approvedHours)} h` : '—'} />
            <Metric label='Unpaid leave (LOP)' value={report ? `${count(report.timeOff.unpaidDays)} days` : '—'} />
            <Metric label='Pending requests' value={report ? count(report.timeOff.pendingRequests) : '—'} />
            <Metric label='Remaining day balance' value={report ? `${count(report.timeOff.remainingBalanceDays)} days` : '—'} />
            <p className='text-muted-foreground pt-2 text-xs'>Balances use approved allocations valid at the period end.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payroll status</CardTitle>
            <CardDescription>Payruns overlapping the period</CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {Object.entries(PAYRUN_STATUSES).map(([status, label]) => (
              <Metric key={status} label={label} value={report ? count(report.payrollStatus[status as keyof typeof PAYRUN_STATUSES]) : '—'} />
            ))}
            <Metric label='Without a contract' value={report ? count(report.contracts.withoutContract) : '—'} />
            <Metric label='Contract without structure' value={report ? count(report.contracts.withoutStructure) : '—'} />
            <Metric label='Contracts ending within 30 days' value={report ? count(report.contracts.expiringSoon) : '—'} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Department breakdown</CardTitle>
          <CardDescription>Headcount and net salary paid in the period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead>
                <tr className='text-muted-foreground border-b text-left'>
                  <th className='pb-3 font-medium'>Department</th>
                  <th className='pb-3 text-right font-medium'>Headcount</th>
                  <th className='pb-3 text-right font-medium'>Gross paid</th>
                  <th className='pb-3 text-right font-medium'>Net paid</th>
                </tr>
              </thead>
              <tbody>
                {report?.costByDepartment.map(row => (
                  <tr key={row.department} className='border-b last:border-0'>
                    <td className='py-3'>{row.department}</td>
                    <td className='py-3 text-right tabular-nums'>{row.headcount}</td>
                    <td className='py-3 text-right tabular-nums'>{money(row.gross)}</td>
                    <td className='py-3 text-right tabular-nums'>{money(row.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report && !report.costByDepartment.length && (
              <p className='text-muted-foreground py-8 text-center text-sm'>No departments match these filters.</p>
            )}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <AlertTriangleIcon className='size-4' />
            Operational alerts
          </CardTitle>
          <CardDescription>Unfinished payruns, missing bank details, duplicate payslips and contract attention items</CardDescription>
        </CardHeader>
        <CardContent className='space-y-2'>
          {report?.alerts.map((alert, index) => (
            <div key={`${alert.kind}-${index}`} className='flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm'>
              <span>{alert.message}</span>
              {alert.payrunId && permissions.canRead ? (
                <Link href={`/payroll/${alert.payrunId}`} className='text-primary hover:underline'>
                  {alert.payrunName}
                </Link>
              ) : alert.employeeId ? (
                <Link href={`/contracts?employee=${encodeURIComponent(alert.employeeId)}`} className='text-primary hover:underline'>
                  Contracts
                </Link>
              ) : null}
            </div>
          ))}
          {report && !report.alerts.length && <p className='text-muted-foreground text-sm'>No payroll alerts for these filters.</p>}
        </CardContent>
      </Card>
      <p className='text-muted-foreground text-xs'>
        Amounts include full payslips whose periods overlap the selected range; historical payslips keep the department
        and employee type recorded when they were computed.
      </p>
    </div>
  )
}

function Filter({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className='grid gap-1.5'>
      <label htmlFor={id} className='text-muted-foreground text-xs'>
        {label}
      </label>
      {children}
    </div>
  )
}
function Kpi({ title, value, detail, icon: Icon }: { title: string; value: string | null; detail: string; icon: typeof WalletIcon }) {
  return (
    <Card className='gap-2 py-4'>
      <CardContent>
        <div className='text-muted-foreground flex items-center justify-between gap-2 text-xs'>
          <span>{title}</span>
          <Icon className='size-4 shrink-0' />
        </div>
        {value === null ? (
          <Skeleton className='mt-3 h-7 w-24' />
        ) : (
          <div className='mt-3 text-xl font-semibold break-words tabular-nums'>{value}</div>
        )}
        <p className='text-muted-foreground mt-1 text-xs'>{detail}</p>
      </CardContent>
    </Card>
  )
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-start justify-between gap-3 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='text-right font-medium tabular-nums'>{value}</span>
    </div>
  )
}
function EmptyChart({ text }: { text: string }) {
  return (
    <div className='text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm'>
      {text}
    </div>
  )
}
