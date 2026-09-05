'use client'
import { DATA_API_CONNECTED } from '@/features/hr/data-availability'
import DataConnectionNotice from '@/features/hr/components/data-connection-notice'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, BarChart3Icon, WalletIcon, FileTextIcon, UsersIcon, CalendarCheckIcon, ClockIcon } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/features/nexacrm/components/ui/card'
import { Button } from '@/features/nexacrm/components/ui/button'
import { DatePicker } from '@/features/nexacrm/components/ui/date-picker'
import SearchableSelect from '@/features/nexacrm/components/ui/searchable-select'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/features/nexacrm/components/ui/chart'
import { useEmployeesStore } from '@/features/employees/store'
import { EMPLOYMENT_TYPE_LABELS } from '@/features/employees/types'
import { today } from '@/features/contracts/types'
import { payrollAttendanceInputs } from '../attendance-input'
import { hoursLabel } from '@/features/attendance/types'
import { useSchedulesStore } from '@/features/working-schedules/store'
import { useTimeOffStore } from '@/features/time-off/store'
import { usePayrollStore } from '../store'
import { payrollContractInputs } from '../contract-input'
import { usePayrollPermissions } from '../permissions'
import { money, PAYRUN_STATUSES } from '../types'
import { payrollReport } from './data'
import { formatRecordCount } from '@/features/nexacrm/lib/record-count'

const count = (number: number) => number.toLocaleString('en-IN', { maximumFractionDigits: 2 })
const chartConfig = { net: { label: 'Net salary paid', color: 'var(--chart-1)' } }

export default function PayrollReports() {
  const employees = useEmployeesStore(state => state.employees)
  const contracts = payrollContractInputs
  const attendance = payrollAttendanceInputs
  const { schedules, assignments } = useSchedulesStore()
  const leave = useTimeOffStore()
  const { payruns, payslips } = usePayrollStore()
  const permissions = usePayrollPermissions()
  const [asOf] = useState(today)
  const [from, setFrom] = useState(asOf.slice(0, 7) + '-01')
  const [to, setTo] = useState(asOf)
  const [department, setDepartment] = useState('all')
  const [employmentType, setEmploymentType] = useState('all')
  const [currency, setCurrency] = useState('INR')
  const validPeriod = Boolean(from && to && from <= to && (new Date(to).getTime() - new Date(from).getTime()) / 86400000 <= 366)
  const report = useMemo(() => payrollReport({ employees, contracts, attendance, schedules, assignments, leave, payruns, payslips }, { from: validPeriod ? from : asOf, to: validPeriod ? to : asOf, department, employmentType, currency }, asOf), [employees, contracts, attendance, schedules, assignments, leave, payruns, payslips, from, to, department, employmentType, currency, asOf, validPeriod])
  if (!permissions.canReport) return <div className="p-8 text-sm">Payroll reports are available to HR and payroll staff.</div>
  if (!DATA_API_CONNECTED) return <div className="space-y-4 py-4"><h1 className="text-lg font-semibold">Payroll dashboard</h1><DataConnectionNotice /></div>
  return <div className="space-y-5 py-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-lg font-semibold"><BarChart3Icon className="size-5" />Payroll dashboard</h1><p className="text-muted-foreground mt-1 text-sm">Salary, attendance and leave from your workspace records.</p></div>{permissions.canRead && <Button variant="outline" size="sm" render={<Link href="/payroll" />}>View payruns</Button>}</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Filter label="Period from" id="payroll-report-from"><DatePicker id="payroll-report-from" value={from} onChange={setFrom} /></Filter>
      <Filter label="Period to" id="payroll-report-to"><DatePicker id="payroll-report-to" value={to} onChange={setTo} /></Filter>
      <Filter label="Department" id="payroll-report-department"><SearchableSelect id="payroll-report-department" value={department} onChange={setDepartment} options={[{ value: 'all', label: 'All departments' }, ...report.departments.map(value => ({ value, label: value }))]} /></Filter>
      <Filter label="Employee type" id="payroll-report-type"><SearchableSelect id="payroll-report-type" value={employmentType} onChange={setEmploymentType} options={[{ value: 'all', label: 'All employee types' }, ...Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))]} /></Filter>
      <Filter label="Currency" id="payroll-report-currency"><SearchableSelect id="payroll-report-currency" value={currency} onChange={setCurrency} options={['INR', 'USD', 'EUR', 'GBP'].map(value => ({ value, label: value }))} /></Filter>
    </div>
    {!validPeriod ? <p role="alert" className="text-destructive text-sm">Choose an ordered date range of at most 366 days.</p> : <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi title="Total net salary paid" value={money(report.netPaid, currency)} icon={WalletIcon} detail={`${report.paid.length} paid payslips`} />
        <Kpi title="Payslips generated" value={count(report.slips.length)} icon={FileTextIcon} detail="For the selected payroll period" />
        <Kpi title="Average salary paid" value={money(report.average, currency)} icon={UsersIcon} detail="Net paid / paid payslips" />
        <Kpi title="Approved time off" value={`${count(report.approvedDays)} days`} icon={CalendarCheckIcon} detail={`${count(report.approvedHours)} hours of hourly leave`} />
        <Kpi title="Attendance health" value={report.attendance.coverage === null ? 'No schedule' : `${report.attendance.coverage}%`} icon={ClockIcon} detail={`${report.attendance.covered} / ${report.attendance.scheduled} scheduled days covered`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle>Salary cost by department</CardTitle><CardDescription>Net salary paid in {currency}</CardDescription></CardHeader><CardContent>{report.paid.length ? <ChartContainer config={chartConfig} className="h-64 w-full"><BarChart data={report.costs}><CartesianGrid vertical={false} /><XAxis dataKey="department" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><YAxis tickLine={false} axisLine={false} width={65} tickFormatter={value => count(Number(value))} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="net" fill="var(--color-net)" radius={4} /></BarChart></ChartContainer> : <EmptyChart text="Mark a payrun paid to see department salary costs." />}</CardContent></Card>
        <Card><CardHeader><CardTitle>Monthly net salary trends</CardTitle><CardDescription>Paid payslips grouped by payroll period end month</CardDescription></CardHeader><CardContent>{report.trends.length ? <ChartContainer config={chartConfig} className="h-64 w-full"><LineChart data={report.trends}><CartesianGrid vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} width={65} /><ChartTooltip content={<ChartTooltipContent />} /><Line dataKey="net" stroke="var(--color-net)" strokeWidth={2} dot={{ r: 4 }} /></LineChart></ChartContainer> : <EmptyChart text="Paid payroll history will appear here." />}</CardContent></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card><CardHeader><CardTitle>Attendance overview</CardTitle><CardDescription>Up to today; scheduled employee-days</CardDescription></CardHeader><CardContent className="space-y-2"><Metric label="Present" value={count(report.attendance.present)} /><Metric label="Late arrivals" value={count(report.attendance.late)} /><Metric label="Absent" value={count(report.attendance.absent)} /><Metric label="Overtime" value={hoursLabel(report.attendance.overtimeMinutes)} /><Metric label="Missing check-outs" value={count(report.attendance.missing)} /><Metric label="Manually corrected" value={count(report.attendance.manualEdits)} /><p className="text-muted-foreground pt-2 text-xs">Coverage includes completed attendance or approved full-day leave. {report.attendance.withoutSchedule} employees have no schedule for this period.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Time off overview</CardTitle><CardDescription>Approved charges within the period</CardDescription></CardHeader><CardContent className="space-y-2"><Metric label="Approved leave" value={`${count(report.approvedDays)} days / ${count(report.approvedHours)} hours`} /><Metric label="Unpaid leave" value={`${count(report.unpaidDays)} days / ${count(report.unpaidHours)} hours`} /><Metric label="Pending requests" value={count(report.pending)} /><Metric label="Remaining day balance" value={`${count(report.balanceDays)} days`} /><Metric label="Remaining hour balance" value={`${count(report.balanceHours)} hours`} /><p className="text-muted-foreground pt-2 text-xs">Balances use approved allocations valid at period end. Day and hour balances are kept separate.</p></CardContent></Card>
        <Card><CardHeader><CardTitle>Payroll status</CardTitle><CardDescription>Payruns overlapping the selected period</CardDescription></CardHeader><CardContent className="space-y-2">{Object.entries(PAYRUN_STATUSES).map(([status, label]) => <Metric key={status} label={label} value={count(report.runs.filter(run => run.status === status).length)} />)}<Metric label="Employees needing contract review" value={count(report.noContract)} /></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle>Department breakdown</CardTitle><CardDescription>Current headcount and historical net salary paid</CardDescription></CardHeader><CardContent><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="pb-3 font-medium">Department</th><th className="pb-3 text-right font-medium">Headcount</th><th className="pb-3 text-right font-medium">Net salary paid ({currency})</th></tr></thead><tbody>{report.costs.map(row => <tr key={row.department} className="border-b last:border-0"><td className="py-3">{row.department}</td><td className="py-3 text-right tabular-nums">{row.headcount}</td><td className="py-3 text-right tabular-nums">{money(row.net, currency)}</td></tr>)}</tbody></table>{!report.costs.length && <p className="text-muted-foreground py-8 text-center text-sm">No departments match these filters.</p>}</div><p className="text-muted-foreground pt-3 text-sm">{formatRecordCount(report.costs.length, 'department')}</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><AlertTriangleIcon className="size-4" />Operational alerts</CardTitle><CardDescription>Missing bank information, duplicate payslips and contract attention items</CardDescription></CardHeader><CardContent className="space-y-2">{report.warnings.map((warning, index) => <div key={`${warning.runId}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"><span>{warning.message}</span>{permissions.canRead && <Link href={'/payroll/' + warning.runId} className="text-primary hover:underline">{warning.runName}</Link>}</div>)}{report.noContract > 0 && <p className="rounded-lg border p-3 text-sm">{report.noContract} employees need a single active contract covering this full period. Review <Link href="/contracts" className="text-primary hover:underline">Contracts</Link> before creating payroll.</p>}{!report.warnings.length && !report.noContract && <p className="text-muted-foreground text-sm">No payroll warnings for these filters.</p>}</CardContent></Card>
      <p className="text-muted-foreground text-xs">Amounts include full payslips whose periods overlap the selected range; they are not prorated again. Salary totals use the selected currency only.</p>
    </>}
  </div>
}
function Filter({ label, id, children }: { label: string; id: string; children: React.ReactNode }) { return <div className="grid gap-1.5"><label htmlFor={id} className="text-muted-foreground text-xs">{label}</label>{children}</div> }
function Kpi({ title, value, detail, icon: Icon }: { title: string; value: string; detail: string; icon: typeof WalletIcon }) { return <Card className="gap-2 py-4"><CardContent><div className="text-muted-foreground flex items-center justify-between gap-2 text-xs"><span>{title}</span><Icon className="size-4 shrink-0" /></div><div className="mt-3 break-words text-xl font-semibold tabular-nums">{value}</div><p className="text-muted-foreground mt-1 text-xs">{detail}</p></CardContent></Card> }
function Metric({ label, value }: { label: string; value: string }) { return <div className="flex items-start justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium tabular-nums">{value}</span></div> }
function EmptyChart({ text }: { text: string }) { return <div className="text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm">{text}</div> }
