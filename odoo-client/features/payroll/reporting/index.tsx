'use client'

import { useState } from 'react'
import Link from 'next/link'
import DashboardView from '@/features/dashboard/dashboard-view'
import type { DashboardData } from '@/features/dashboard/types'
import { DepartmentChart, EmptyChart, PayrollTrend, money, number } from '@/features/dashboard/dashboard-charts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/features/nexacrm/components/ui/card'
import { TableSearch } from '@/features/nexacrm/components/data-table/table-search'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/features/nexacrm/components/ui/table'

export default function PayrollReports() {
  return <DashboardView
    title="HR & payroll reports"
    description="Salary, attendance and leave reports from your connected records."
    renderContent={(data, canReadPayroll) => <ReportContent data={data} canReadPayroll={canReadPayroll} />}
  />
}

function ReportContent({ data, canReadPayroll }: { data: DashboardData; canReadPayroll: boolean }) {
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const departments = data.departments.filter(row => row.department.toLowerCase().includes(query))
  const statuses = { draft: 'Draft', computed: 'Computed', validated: 'Validated', paid: 'Paid' }
  const alerts = data.alerts.filter(alert => alert.count > 0 && (
    alert.code !== 'duplicate_payslip' || data.period.startDate.slice(0, 7) === data.period.endDate.slice(0, 7)
  ))

  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Kpi title="Net salary paid" value={money(data.totals.netPaid, data.currency)} detail={`${number(data.totals.statusCounts.paid)} paid payslips`} />
      <Kpi title="Payslips generated" value={number(data.totals.payslips)} detail="All statuses in the selected period" />
      <Kpi title="Average paid payslip" value={money(data.averageNet, data.currency)} detail="Net paid divided by paid payslips" />
      <Kpi title="Approved leave" value={`${number(data.timeOff.approvedDays)} days`} detail={`${number(data.timeOff.approvedHours)} hours recorded separately`} />
      <Kpi title="Present share of records" value={data.attendance.coverage === null ? '—' : `${number(data.attendance.coverage)}%`} detail={`${number(data.attendance.present)} of ${number(data.attendance.records)} recorded entries`} />
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Salary cost by department" description={`Net salary paid within the selected period · ${data.currency}`}>
        <DepartmentChart data={data.departments} metric="net" currency={data.currency} />
      </Panel>
      <Panel title="Monthly net salary paid" description={`12 months ending ${data.period.endDate.slice(0, 7)} · grouped by payroll end month`}>
        {data.trends.some(row => row.payslips > 0)
          ? <PayrollTrend data={data.trends} currency={data.currency} endDate={data.period.endDate} />
          : <EmptyChart>No paid payroll in this 12-month window.</EmptyChart>}
      </Panel>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Attendance overview" description="Recorded attendance within the selected dates">
        <div className="space-y-3">
          <Metric label="Present" value={number(data.attendance.present)} />
          <Metric label="Absent" value={number(data.attendance.absent)} />
          <Metric label="Incomplete / open" value={number(data.attendance.incomplete)} />
          <Metric label="Worked hours" value={number(data.attendance.workedHours)} />
          <Metric label="Overtime hours" value={number(data.attendance.overtimeHours)} />
          <Metric label="Checked in without check-out" value={number(data.attendance.missingCheckOuts)} />
          <Metric label="Manually corrected" value={number(data.attendance.manualEdits)} />
          <p className="text-muted-foreground text-xs">Open records may include ongoing shifts. These counts measure recorded attendance, not coverage against a work schedule.</p>
        </div>
      </Panel>
      <Panel title="Time off overview" description="Approved charges within the selected dates">
        <div className="space-y-3">
          <Metric label="Approved days" value={number(data.timeOff.approvedDays)} />
          <Metric label="Approved hours" value={number(data.timeOff.approvedHours)} />
          <Metric label="Unpaid days" value={number(data.timeOff.unpaidDays)} />
          <Metric label="Unpaid hours" value={number(data.timeOff.unpaidHours)} />
          <Metric label="Pending requests in period" value={number(data.timeOff.pendingRequests)} />
          <Metric label="Remaining day balance" value={number(data.timeOff.remainingDays)} />
          <Metric label="Remaining hour balance" value={number(data.timeOff.remainingHours)} />
          <p className="text-muted-foreground text-xs">Balances are measured at period end. Days and hours are separate units.</p>
        </div>
      </Panel>
      <Panel title="Payroll status" description="Company-wide payruns overlapping the period">
        <div className="space-y-3">
          {Object.entries(statuses).map(([status, label]) => <Metric key={status} label={label} value={number(data.payrunStatusCounts[status as keyof typeof statuses])} />)}
          <Metric label="Filtered paid employees" value={number(data.totals.employeesPaid)} />
          <Metric label="Filtered gross salary paid" value={money(data.totals.grossPaid, data.currency)} />
          <Metric label="Deductions & contributions" value={money(data.totals.deductionsPaid, data.currency)} />
          <p className="text-muted-foreground text-xs">Payrun counts are company-wide. Salary amounts follow the department and currency filters.</p>
          {canReadPayroll && <Link href="/payroll" className="text-primary inline-block text-sm hover:underline">View payruns</Link>}
        </div>
      </Panel>
    </div>
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3"><CardTitle>Department breakdown</CardTitle><TableSearch value={search} onValueChange={setSearch} placeholder="Search departments…" /></div>
        <CardDescription>Current active headcount and payroll in the selected period</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Department</TableHead><TableHead className="text-right">Active employees</TableHead><TableHead className="text-right">Payslips</TableHead><TableHead className="text-right">Gross paid ({data.currency})</TableHead><TableHead className="text-right">Net paid ({data.currency})</TableHead></TableRow></TableHeader>
          <TableBody>
            {departments.map(row => <TableRow key={row.department}><TableCell className="font-medium">{row.department}</TableCell><TableCell className="text-right tabular-nums">{number(row.headcount)}</TableCell><TableCell className="text-right tabular-nums">{number(row.payslips)}</TableCell><TableCell className="text-right tabular-nums">{money(row.gross, data.currency)}</TableCell><TableCell className="text-right tabular-nums">{money(row.net, data.currency)}</TableCell></TableRow>)}
            {!departments.length && <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">No departments match your search and filters.</TableCell></TableRow>}
          </TableBody>
        </Table>
        <p className="text-muted-foreground mt-3 text-sm">{number(departments.length)} department{departments.length === 1 ? '' : 's'}</p>
      </CardContent>
    </Card>
    <Panel title="Operational review" description="Contract coverage, payroll checks and saved warnings">
      <div className="space-y-3">
        {alerts.map(alert => <div key={alert.code} className="rounded-lg border p-3 text-sm">
          <p>{alert.code === 'duplicate_payslip' ? `${number(alert.count)} employees have multiple payslips in the selected period.` : alert.message}</p>
          {alert.code === 'duplicate_payslip' && <p className="text-muted-foreground mt-1 text-xs">Review payroll dates before treating these as duplicates.</p>}
          {alert.code === 'missing_contract' && <p className="text-muted-foreground mt-1 text-xs">A contract change within the selection can cause this; check coverage for the actual payroll dates.</p>}
          {alert.code === 'unvalidated_payrun' && <p className="text-muted-foreground mt-1 text-xs">This count is company-wide.</p>}
        </div>)}
        {data.warnings.length > 0 && <details className="rounded-lg border p-3"><summary className="cursor-pointer text-sm font-medium">{number(data.warnings.length)} saved company-wide payroll warnings</summary><div className="mt-3 max-h-64 space-y-3 overflow-y-auto">{data.warnings.slice(0, 10).map((warning, index) => <div key={`${warning.payrunId}-${index}`} className="text-sm"><p>{warning.message}</p>{canReadPayroll && <Link href={`/payroll/${encodeURIComponent(warning.payrunId)}`} className="text-primary text-xs hover:underline">{warning.payrunName}</Link>}</div>)}</div>{data.warnings.length > 10 && <p className="text-muted-foreground mt-3 text-xs">Showing the first 10. Open a payrun for its full warning list.</p>}</details>}
        {!alerts.length && !data.warnings.length && <p className="text-muted-foreground text-sm">No operational warnings reported for this period.</p>}
      </div>
    </Panel>
    <p className="text-muted-foreground text-xs">Period: {data.period.startDate}–{data.period.endDate}. Salary totals include full paid payslips overlapping these dates in {data.currency}; amounts are not prorated. The trend uses its own 12-month window. Headcount is a current snapshot. Zero paid amounts do not mean no salary is owed.</p>
  </>
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader><CardContent>{children}</CardContent></Card>
}
function Kpi({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <Card><CardContent><p className="text-muted-foreground text-sm">{title}</p><p className="mt-3 break-words text-xl font-semibold tabular-nums">{value}</p><p className="text-muted-foreground mt-2 text-xs">{detail}</p></CardContent></Card>
}
function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-3 text-sm"><span className="text-muted-foreground">{label}</span><span className="text-right font-medium tabular-nums">{value}</span></div>
}
