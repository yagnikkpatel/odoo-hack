'use client'

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/features/nexacrm/components/ui/chart'

export const number = (value: number) => value.toLocaleString('en-IN', { maximumFractionDigits: 1 })
export const compact = (value: number) => new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
export const money = (value: number, currency: string) => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
export const monthLabel = (value: string) => new Date(`${value}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })

export function EmptyChart({ children }: { children: React.ReactNode }) {
  return <div className="text-muted-foreground flex min-h-56 items-center justify-center rounded-lg border border-dashed px-8 text-center text-sm">{children}</div>
}

export function PayrollTrend({ data, currency, endDate }: { data: { month: string; net: number; payslips: number }[]; currency: string; endDate: string }) {
  const end = new Date(`${endDate}T12:00:00`)
  const series = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(end.getFullYear(), end.getMonth() - 11 + index, 1)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    return data.find(row => row.month === month) || { month, net: 0, payslips: 0 }
  })
  return <ChartContainer config={{ net: { label: `Net paid (${currency})`, color: 'var(--chart-1)' } }} className="h-64 w-full" aria-label="Monthly net payroll paid over the twelve months ending in the selected end month">
    <AreaChart accessibilityLayer data={series} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
      <CartesianGrid vertical={false} />
      <XAxis dataKey="month" axisLine={false} tickLine={false} tickFormatter={monthLabel} minTickGap={22} tickMargin={10} />
      <YAxis axisLine={false} tickLine={false} tickFormatter={compact} width={54} />
      <ChartTooltip content={<ChartTooltipContent labelFormatter={value => monthLabel(String(value))} formatter={value => money(Number(value), currency)} />} />
      <Area type="monotone" dataKey="net" stroke="var(--color-net)" fill="var(--color-net)" fillOpacity={0.12} strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: 'var(--color-net)' }} activeDot={{ r: 5 }} />
    </AreaChart>
  </ChartContainer>
}

export function DepartmentChart({ data, metric, currency }: { data: { department: string; headcount: number; net: number }[]; metric: 'headcount' | 'net'; currency: string }) {
  const sorted = [...data].sort((a, b) => b[metric] - a[metric]).filter(row => row[metric] > 0)
  const rows = sorted.slice(0, 8)
  if (sorted.length > 8) rows.push({ department: 'Other departments', headcount: sorted.slice(8).reduce((sum, row) => sum + row.headcount, 0), net: sorted.slice(8).reduce((sum, row) => sum + row.net, 0) })
  if (!rows.length) return <EmptyChart>No {metric === 'headcount' ? 'workforce' : 'paid payroll'} records for these filters.</EmptyChart>
  return <ChartContainer config={{ [metric]: { label: metric === 'headcount' ? 'Employees' : `Net paid (${currency})`, color: 'var(--chart-2)' } }} className="h-72 w-full" aria-label={metric === 'headcount' ? 'Current active workforce by department' : 'Net payroll paid by department'}>
    <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ right: 16, left: 0, top: 0 }}>
      <CartesianGrid horizontal={false} />
      <YAxis dataKey="department" type="category" tickLine={false} axisLine={false} width={115} tick={{ fontSize: 11 }} tickFormatter={value => String(value).length > 19 ? `${String(value).slice(0, 17)}…` : String(value)} />
      <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={metric !== 'headcount'} tickFormatter={compact} />
      <ChartTooltip content={<ChartTooltipContent formatter={value => metric === 'headcount' ? `${number(Number(value))} employees` : money(Number(value), currency)} />} />
      <Bar dataKey={metric} fill={`var(--color-${metric})`} radius={[0, 4, 4, 0]} maxBarSize={19} />
    </BarChart>
  </ChartContainer>
}

export function AttendanceChart({ present, absent, incomplete }: { present: number; absent: number; incomplete: number }) {
  const rows = [
    { name: 'Present', value: present, fill: 'var(--chart-1)' },
    { name: 'Absent', value: absent, fill: 'var(--chart-4)' },
    { name: 'Incomplete / open', value: incomplete, fill: 'var(--chart-3)' }
  ]
  return <div className="flex flex-col items-center gap-3 sm:flex-row">
    <ChartContainer config={{ value: { label: 'Attendance records' } }} className="h-48 w-48 shrink-0" aria-label="Recorded attendance split into present, absent and incomplete or open records">
      <PieChart accessibilityLayer><ChartTooltip content={<ChartTooltipContent nameKey="name" hideLabel />} /><Pie data={rows.filter(row => row.value > 0)} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} strokeWidth={0}>{rows.filter(row => row.value > 0).map(row => <Cell key={row.name} fill={row.fill} />)}</Pie></PieChart>
    </ChartContainer>
    <div className="w-full space-y-4">{rows.map(row => <div key={row.name} className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: row.fill }} />{row.name}</span><span className="font-medium tabular-nums">{number(row.value)}</span></div>)}</div>
  </div>
}

export function LeaveChart({ data, unit }: { data: { name: string; approved: number }[]; unit: 'days' | 'hours' }) {
  const rows = data.filter(row => row.approved > 0).sort((a, b) => b.approved - a.approved)
  if (!rows.length) return <EmptyChart>No approved leave in {unit} charged in this period.</EmptyChart>
  return <ChartContainer config={{ approved: { label: `Approved ${unit}`, color: 'var(--chart-3)' } }} className="h-56 w-full" aria-label={`Approved leave by type in ${unit}`}>
    <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ right: 16 }}><CartesianGrid horizontal={false} /><YAxis dataKey="name" type="category" tickLine={false} axisLine={false} width={115} tick={{ fontSize: 11 }} tickFormatter={value => String(value).length > 19 ? `${String(value).slice(0, 17)}…` : String(value)} /><XAxis type="number" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent formatter={value => `${number(Number(value))} ${unit}`} />} /><Bar dataKey="approved" fill="var(--color-approved)" radius={[0, 4, 4, 0]} maxBarSize={24} /></BarChart>
  </ChartContainer>
}
