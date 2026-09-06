'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ActivityIcon, ArrowUpRightIcon, CalendarDaysIcon, CheckCircle2Icon, CircleAlertIcon, Clock3Icon, LockKeyholeIcon, RefreshCwIcon, UsersIcon, WalletIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { ApiError } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/nexacrm/components/ui/card'
import { Button } from '@/features/nexacrm/components/ui/button'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'
import { Skeleton } from '@/features/nexacrm/components/ui/skeleton'
import { PAGE_BODY } from '@/features/nexacrm/lib/page-shape'
import { useCurrentActorStore } from '@/features/nexacrm/store/use-current-actor-store'
import { usePayrollPermissions } from '@/features/payroll/permissions'
import { useTimeOffPermissions } from '@/features/time-off/permissions'
import { useAttendancePermissions } from '@/features/attendance/permissions'
import { getDashboard } from './service'
import type { DashboardData, DashboardQuery } from './types'
import { AttendanceChart, DepartmentChart, EmptyChart, LeaveChart, PayrollTrend, money, number } from './dashboard-charts'

function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function initialQuery(): DashboardQuery {
  const now = new Date()
  return { startDate: localDate(new Date(now.getFullYear(), now.getMonth() - 5, 1)), endDate: localDate(now), currency: 'INR' }
}
const dateLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
type Result = { key: string; actorId?: string; data?: DashboardData; error?: string; status?: number; loadedAt?: Date }

export default function DashboardView({
  title = 'People & payroll',
  description = 'A clear picture of your workforce, payroll and leave.',
  renderContent,
}: {
  title?: string
  description?: string
  renderContent?: (data: DashboardData, canReadPayroll: boolean) => React.ReactNode
} = {}) {
  const actorId = useCurrentActorStore(state => state.actorId)
  const permissions = usePayrollPermissions()
  const attendance = useAttendancePermissions()
  const [query, setQuery] = useState(initialQuery)
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const days = (new Date(query.endDate).getTime() - new Date(query.startDate).getTime()) / 86400000
  const valid = Boolean(query.startDate && query.endDate && Number.isFinite(days) && days >= 0 && days <= 365)
  const key = JSON.stringify([actorId, query, revision])
  const pending = valid && result?.key !== key
  const current = result?.key === key ? result : null
  const data = current?.data
  const options = result?.actorId === actorId ? result?.data?.filters : undefined

  useEffect(() => {
    if (!valid || !permissions.canReport) return
    const controller = new AbortController()
    getDashboard(query, controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ key, actorId, data, loadedAt: new Date() })
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setResult({ key, actorId, error: error instanceof Error ? error.message : 'Dashboard data could not be loaded.', status: error instanceof ApiError ? error.status : undefined })
    })
    return () => controller.abort()
  }, [actorId, key, query, valid, permissions.canReport])

  const update = (patch: Partial<DashboardQuery>) => setQuery(value => ({ ...value, ...patch }))
  const preset = (months: number) => {
    const now = new Date()
    update({ startDate: localDate(new Date(now.getFullYear(), now.getMonth() - months + 1, 1)), endDate: localDate(now) })
  }

  if (!permissions.canReport) return <p role="alert" className="text-muted-foreground py-12">You do not have access to company reports.</p>

  return <div className="flex min-h-full flex-col"><div className={PAGE_BODY}>
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">PeoplePay360 / Reports</p><h1 className="text-2xl font-semibold tracking-tight">{title}</h1><p className="text-muted-foreground mt-1 text-sm">{description}</p></div>
      <div className="flex items-center gap-3"><span className="text-muted-foreground hidden text-xs sm:block" role="status">{pending ? 'Updating insights…' : current?.loadedAt ? `Updated ${current.loadedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}</span><Button variant="outline" size="sm" disabled={pending || !valid} onClick={() => setRevision(value => value + 1)}><RefreshCwIcon className={pending ? 'size-4 animate-spin' : 'size-4'} />Refresh</Button></div>
    </header>
    <div className="bg-card flex flex-wrap items-end gap-3 rounded-xl border p-4">
      <Filter label="From" id="dashboard-from"><DatePicker id="dashboard-from" value={query.startDate} onChange={startDate => update({ startDate })} /></Filter>
      <Filter label="To" id="dashboard-to"><DatePicker id="dashboard-to" value={query.endDate} onChange={endDate => update({ endDate })} /></Filter>
      <Filter label="Department" id="dashboard-department"><SearchableSelect id="dashboard-department" value={query.department || 'all'} onChange={value => update({ department: value === 'all' ? undefined : value })} options={[{ value: 'all', label: 'All departments' }, ...(options?.departments || []).map(value => ({ value, label: value }))]} className="min-w-40" /></Filter>
      <Filter label="Currency" id="dashboard-currency"><SearchableSelect id="dashboard-currency" value={query.currency} onChange={currency => update({ currency })} options={[...new Set([query.currency, ...(options?.currencies || [])])].map(value => ({ value, label: value }))} className="min-w-20" /></Filter>
      <div className="flex flex-wrap gap-1.5 pb-0.5 sm:ml-auto"><Button variant="ghost" size="sm" onClick={() => preset(1)}>This month</Button><Button variant="ghost" size="sm" onClick={() => preset(6)}>Last 6 months</Button><Button variant="ghost" size="sm" onClick={() => { const now = new Date(); update({ startDate: `${now.getFullYear()}-01-01`, endDate: localDate(now) }) }}>This year</Button></div>
    </div>
    {!valid && <p role="alert" className="text-destructive text-sm">Choose an ordered date range of at most 366 days.</p>}
    {pending && <DashboardSkeleton />}
    {current?.error && <Card><CardContent className="flex flex-col items-center gap-3 py-10 text-center">{current.status === 403 ? <LockKeyholeIcon className="text-muted-foreground size-8" /> : <CircleAlertIcon className="text-muted-foreground size-8" />}<h2 className="font-medium">{current.status === 403 ? 'Company insights require reporting access' : 'Unable to load your dashboard'}</h2><p className="text-muted-foreground max-w-lg text-sm">{current.error}</p>{current.status === 401 ? <Button render={<Link href="/login" />}>Sign in</Button> : current.status === 403 ? (attendance.canReadOwn && <Button variant="outline" render={<Link href="/attendance" />}>View attendance</Button>) : <Button variant="outline" onClick={() => setRevision(value => value + 1)}>Try again</Button>}</CardContent></Card>}
    {data && (renderContent ? renderContent(data, permissions.canReadPayruns) : <DashboardContent data={data} canReadPayroll={permissions.canReadPayruns} />)}
  </div></div>
}

export function DashboardContent({ data, canReadPayroll = false }: { data: DashboardData; canReadPayroll?: boolean }) {
  const [departmentMetric, setDepartmentMetric] = useState<'headcount' | 'net'>('headcount')
  const [leaveUnit, setLeaveUnit] = useState<'days' | 'hours'>('days')
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat title="Active workforce" value={number(data.headcount)} detail={`${data.departments.filter(row => row.headcount > 0).length} departments · current snapshot`} icon={UsersIcon} />
      <Stat title="Net payroll paid" value={money(data.totals.netPaid, data.currency)} detail={`${number(data.totals.employeesPaid)} employees · ${number(data.totals.statusCounts.paid)} paid payslips`} icon={WalletIcon} footnote={data.netPaidChange === null ? 'No paid payroll in the comparison period' : `${data.netPaidChange > 0 ? '+' : ''}${number(data.netPaidChange)}% vs preceding equal-length period`} />
      <Stat title="Present share of records" value={data.attendance.coverage === null ? '—' : `${number(data.attendance.coverage)}%`} detail={`${number(data.attendance.present)} present / ${number(data.attendance.records)} records`} icon={ActivityIcon} footnote="Recorded attendance, not scheduled attendance" />
      <Stat title="Time-off requests pending" value={number(data.timeOff.pendingRequests)} detail={`${number(data.timeOff.approvedDays)} days of approved leave`} icon={CalendarDaysIcon} footnote={`${number(data.timeOff.approvedHours)} hours approved separately`} />
    </div>
    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-3"><CardHeader><CardTitle>Net payroll paid</CardTitle><CardDescription>12 months ending {new Date(`${data.period.endDate}T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })} · {data.currency}</CardDescription></CardHeader><CardContent>{data.trends.some(row => row.payslips > 0) ? <PayrollTrend data={data.trends} currency={data.currency} endDate={data.period.endDate} /> : <EmptyChart>No paid payroll in this 12-month window.</EmptyChart>}<p className="text-muted-foreground mt-4 text-xs">Paid payslips grouped by payroll end month. A zero means no paid payslips, not no salary owed. This chart uses its own 12-month window.</p></CardContent></Card>
      <Card className="xl:col-span-2"><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Department overview</CardTitle><Segments value={departmentMetric} options={[{ value: 'headcount', label: 'People' }, { value: 'net', label: 'Payroll' }]} onChange={setDepartmentMetric} /></div><CardDescription>{departmentMetric === 'headcount' ? 'Where your active workforce sits today' : `Net salary paid in the selected period · ${data.currency}`}</CardDescription></CardHeader><CardContent><DepartmentChart data={data.departments} metric={departmentMetric} currency={data.currency} />{data.departments.length > 8 && <p className="text-muted-foreground mt-2 text-xs">Top 8 departments, with the rest grouped as Other.</p>}</CardContent></Card>
    </div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader><CardTitle>Attendance quality</CardTitle><CardDescription>{number(data.attendance.records)} records across {number(data.attendance.employees)} employees in the period</CardDescription></CardHeader><CardContent>{data.attendance.records > 0 ? <AttendanceChart {...data.attendance} /> : <EmptyChart>No attendance recorded in this period.</EmptyChart>}<div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4"><SmallMetric label="Worked hours" value={number(data.attendance.workedHours)} /><SmallMetric label="Overtime hours" value={number(data.attendance.overtimeHours)} /><SmallMetric label="Manual edits" value={number(data.attendance.manualEdits)} /></div><p className="text-muted-foreground mt-4 text-xs">Incomplete records may include ongoing shifts. {number(data.attendance.missingCheckOuts)} checked-in records have no check-out.</p></CardContent></Card>
      <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Leave usage by type</CardTitle><Segments value={leaveUnit} options={[{ value: 'days', label: 'Days' }, { value: 'hours', label: 'Hours' }]} onChange={setLeaveUnit} /></div><CardDescription>Approved leave charged inside your selected dates</CardDescription></CardHeader><CardContent><LeaveChart data={data.timeOff.types.filter(row => row.unit === leaveUnit)} unit={leaveUnit} /><div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4"><SmallMetric label={`Approved ${leaveUnit}`} value={number(leaveUnit === 'days' ? data.timeOff.approvedDays : data.timeOff.approvedHours)} /><SmallMetric label={`Unpaid ${leaveUnit}`} value={number(leaveUnit === 'days' ? data.timeOff.unpaidDays : data.timeOff.unpaidHours)} /><SmallMetric label={`Balance ${leaveUnit}`} value={number(leaveUnit === 'days' ? data.timeOff.remainingDays : data.timeOff.remainingHours)} /></div><p className="text-muted-foreground mt-4 text-xs">Balances are measured at period end. Day-based and hourly leave stay separate.</p></CardContent></Card>
    </div>
    <div className="grid gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-2"><CardHeader><CardTitle>Payroll progress</CardTitle><CardDescription>All company payruns in the selected period</CardDescription></CardHeader><CardContent className="space-y-4"><PayrollPipeline data={data} /><div className="grid grid-cols-2 gap-4 border-t pt-4"><SmallMetric label="Average paid payslip" value={money(data.averageNet, data.currency)} /><SmallMetric label="Deductions & contributions" value={money(data.totals.deductionsPaid, data.currency)} /></div>{canReadPayroll && <Link href="/payroll" className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline">Open payroll<ArrowUpRightIcon className="size-4" /></Link>}</CardContent></Card>
      <Card className="xl:col-span-3"><CardHeader><CardTitle>Needs attention</CardTitle><CardDescription>Actions informed by your selected period</CardDescription></CardHeader><CardContent className="space-y-3"><Actions data={data} canReadPayroll={canReadPayroll} /></CardContent></Card>
    </div>
    <p className="text-muted-foreground text-xs leading-relaxed">Source: your connected workforce, attendance, leave and payroll records. Period: {dateLabel(data.period.startDate)}–{dateLabel(data.period.endDate)}. Comparison: {dateLabel(data.period.previousStartDate)}–{dateLabel(data.period.previousEndDate)}. Salary totals include full payslips overlapping the period in {data.currency}; they are not prorated. Workforce is a current snapshot.</p>
  </>
}
function Filter({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="grid gap-1.5"><label htmlFor={id} className="text-muted-foreground text-xs">{label}</label>{children}</div>
}
function Stat({ title, value, detail, footnote, icon: Icon }: { title: string; value: string; detail: string; footnote?: string; icon: LucideIcon }) {
  return <Card><CardContent><div className="text-muted-foreground flex items-center justify-between gap-3"><span className="text-sm">{title}</span><Icon className="size-4" /></div><p className="mt-4 text-2xl font-semibold tracking-tight tabular-nums">{value}</p><p className="text-muted-foreground mt-2 text-xs">{detail}</p>{footnote && <p className="text-muted-foreground mt-1 text-xs">{footnote}</p>}</CardContent></Card>
}
function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-muted-foreground text-xs">{label}</p><p className="mt-1 break-words text-sm font-semibold tabular-nums">{value}</p></div>
}
function Segments<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return <div className="bg-muted flex rounded-lg p-0.5">{options.map(option => <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)} className={`rounded-md px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-ring ${value === option.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{option.label}</button>)}</div>
}
function PayrollPipeline({ data }: { data: DashboardData }) {
  const statuses = [{ key: 'draft' as const, label: 'Draft', color: 'var(--chart-4)' }, { key: 'computed' as const, label: 'Computed', color: 'var(--chart-3)' }, { key: 'validated' as const, label: 'Validated', color: 'var(--chart-2)' }, { key: 'paid' as const, label: 'Paid', color: 'var(--chart-1)' }]
  const total = Object.values(data.payrunStatusCounts).reduce((sum, count) => sum + count, 0)
  return <><div className="flex items-baseline gap-2"><span className="text-3xl font-semibold tabular-nums">{number(total)}</span><span className="text-muted-foreground text-sm">payruns</span></div>{total > 0 && <div className="flex h-3 gap-1 overflow-hidden rounded-full" role="img" aria-label={statuses.map(row => `${row.label}: ${data.payrunStatusCounts[row.key]}`).join(', ')}>{statuses.filter(row => data.payrunStatusCounts[row.key] > 0).map(row => <div key={row.key} style={{ width: `${data.payrunStatusCounts[row.key] / total * 100}%`, background: row.color }} />)}</div>}<p className="text-muted-foreground text-xs">Runs are company-wide. Payslip counts follow the selected department and currency.</p><div className="space-y-3">{statuses.map(row => <div key={row.key} className="flex items-center justify-between gap-2 text-sm"><span className="text-muted-foreground flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: row.color }} />{row.label}</span><span className="tabular-nums">{number(data.payrunStatusCounts[row.key])} <span className="text-muted-foreground text-xs">runs · {number(data.totals.statusCounts[row.key])} slips</span></span></div>)}</div></>
}
function Actions({ data, canReadPayroll }: { data: DashboardData; canReadPayroll: boolean }) {
  const { canReadAny } = useTimeOffPermissions()
  const multiMonth = data.period.startDate.slice(0, 7) !== data.period.endDate.slice(0, 7)
  const alerts = data.alerts.filter(alert => alert.count > 0 && alert.code !== 'unvalidated_payrun' && !(multiMonth && alert.code === 'duplicate_payslip'))
  const pendingRuns = data.payrunStatusCounts.draft + data.payrunStatusCounts.computed + data.payrunStatusCounts.validated
  const noActions = !alerts.length && !pendingRuns && !data.timeOff.pendingRequests && !data.warnings.length
  return <>
    {data.timeOff.pendingRequests > 0 && <Action icon={CalendarDaysIcon} title={`${number(data.timeOff.pendingRequests)} leave requests await review`} detail="Review requests overlapping this period to keep leave decisions moving." href={canReadAny ? '/time-off/requests' : undefined} />}
    {pendingRuns > 0 && <Action icon={Clock3Icon} title={`${number(pendingRuns)} payruns are not yet paid`} detail={`Company-wide: ${number(data.payrunStatusCounts.draft)} draft · ${number(data.payrunStatusCounts.computed)} computed · ${number(data.payrunStatusCounts.validated)} validated`} href={canReadPayroll ? '/payroll' : undefined} />}
    {alerts.map(alert => <Action key={alert.code} icon={CircleAlertIcon} title={alert.code === 'duplicate_payslip' ? `${number(alert.count)} employees have multiple payslips in this selection` : alert.message} detail={alert.code === 'duplicate_payslip' ? 'Expected across multiple payroll months; check for overlap before treating these as duplicates.' : alert.code === 'missing_contract' ? 'A contract change within the selection can cause this. Review coverage for the actual payroll dates.' : alert.blocking ? 'Resolve before processing the affected payroll.' : 'Review the affected records for the selected dates.'} />)}
    {data.warnings.length > 0 && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{number(data.warnings.length)} saved company-wide payroll warnings</summary><div className="mt-3 max-h-64 space-y-3 overflow-y-auto">{data.warnings.slice(0, 10).map((warning, index) => <div key={`${warning.payrunId}-${index}`} className="text-muted-foreground text-xs"><p>{warning.message}</p>{canReadPayroll ? <Link href={`/payroll/${encodeURIComponent(warning.payrunId)}`} className="text-primary mt-1 inline-block hover:underline">{warning.payrunName}</Link> : <p className="mt-1">{warning.payrunName}</p>}</div>)}</div>{data.warnings.length > 10 && <p className="text-muted-foreground mt-3 text-xs">Showing the first 10. Open the relevant payrun for its full warnings.</p>}</details>}
    {noActions && <div className="text-muted-foreground flex items-center gap-3 py-6 text-sm"><CheckCircle2Icon className="size-5" />No pending payroll or leave actions reported for this period.</div>}
  </>
}
function Action({ icon: Icon, title, detail, href }: { icon: LucideIcon; title: string; detail: string; href?: string }) {
  const content = <><span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg"><Icon className="size-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="text-muted-foreground mt-1 block text-xs">{detail}</span></span>{href && <ArrowUpRightIcon className="text-muted-foreground size-4 shrink-0" />}</>
  return href ? <Link href={href} className="hover:bg-muted/40 flex items-start gap-3 rounded-lg border p-3 transition-colors">{content}</Link> : <div className="flex items-start gap-3 rounded-lg border p-3">{content}</div>
}
function DashboardSkeleton() {
  return <div aria-label="Loading dashboard" role="status" className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Card key={index}><CardContent className="space-y-4"><Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-36" /><Skeleton className="h-3 w-40" /></CardContent></Card>)}</div><div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <Card key={index}><CardContent className="space-y-5"><Skeleton className="h-5 w-40" /><Skeleton className="h-56 w-full" /></CardContent></Card>)}</div><span className="sr-only">Loading your live workforce and payroll insights.</span></div>
}
