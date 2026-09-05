'use client'

import Link from 'next/link'
import { Card } from '@/features/nexacrm/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/features/nexacrm/components/ui/table'
import { EMPLOYMENT_TYPES, RULE_CATEGORIES, formatDate, formatPeriod, isLocked, money } from '../types'
import type { Payslip } from '../types'
import PayrollStatusBadge from '../components/status-badge'
import PayrollWarnings from '../components/warnings'

function Facts({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className='grid grid-cols-2 gap-x-4 gap-y-4 text-sm sm:grid-cols-3'>
      {items.map(([label, value]) => (
        <div key={label} className='min-w-0'>
          <dt className='text-muted-foreground text-xs'>{label}</dt>
          <dd className='mt-1 break-words tabular-nums'>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function PayslipContent({ slip, compact = false }: { slip: Payslip; compact?: boolean }) {
  const computed = slip.status !== 'draft'
  const totals: [string, number][] = [
    ['Basic', slip.basic],
    ['Allowances', slip.allowances],
    ['Gross salary', slip.gross],
    ['Deductions', slip.deductions],
    ['Employer contributions', slip.contributions],
    ['Net salary', slip.net]
  ]
  return (
    <div className='space-y-5'>
      {compact && (
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <p className='truncate font-medium'>{slip.employeeName}</p>
            <p className='text-muted-foreground text-xs'>{formatPeriod(slip.startDate, slip.endDate)}</p>
          </div>
          <PayrollStatusBadge status={slip.status} />
        </div>
      )}
      <Facts
        items={[
          [
            'Employee',
            <Link key='employee' className='font-medium hover:underline' href={`/employees/${slip.employeeId}`}>
              {slip.employeeName}
            </Link>
          ],
          [
            'Pay run',
            <Link key='payrun' className='font-medium hover:underline' href={`/payroll/${slip.payrunId}`}>
              {slip.payrunName}
            </Link>
          ],
          ['Salary structure', slip.structureName],
          ['Period', formatPeriod(slip.startDate, slip.endDate)],
          ['Department', slip.department || 'Not set'],
          ['Employment type', EMPLOYMENT_TYPES[slip.employmentType]]
        ]}
      />
      <section>
        <h2 className='mb-2 text-sm font-semibold'>Worked days</h2>
        {computed ? (
          <Facts
            items={[
              ['Paid days', `${slip.paidDays} of ${slip.periodDays}`],
              ['Loss of pay', `${slip.unpaidDays} day${slip.unpaidDays === 1 ? '' : 's'}`],
              ['Scheduled days', String(slip.expectedDays)],
              ['Present days', String(slip.workedDays)],
              ['Worked hours', `${slip.workedHours} h`],
              ['Overtime', `${slip.overtimeHours} h`]
            ]}
          />
        ) : (
          <p className='text-muted-foreground text-sm'>Compute the parent payrun to fill in attendance and leave.</p>
        )}
      </section>
      <section>
        <h2 className='mb-2 text-sm font-semibold'>Salary computation</h2>
        <Card className='gap-0 overflow-hidden py-0'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                {!compact && <TableHead>Code</TableHead>}
                <TableHead>Category</TableHead>
                <TableHead className='text-right'>Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slip.lines.map((line, index) => (
                <TableRow key={`${line.ruleId}-${index}`} className={line.category === 'net' ? 'font-medium' : undefined}>
                  <TableCell>
                    {line.name}
                    {compact && <span className='text-muted-foreground ml-1 font-mono text-xs'>{line.code}</span>}
                  </TableCell>
                  {!compact && <TableCell className='font-mono text-xs'>{line.code}</TableCell>}
                  <TableCell className='text-muted-foreground'>{RULE_CATEGORIES[line.category]}</TableCell>
                  <TableCell className='text-right tabular-nums'>{money(line.amount, slip.currency)}</TableCell>
                </TableRow>
              ))}
              {!slip.lines.length && (
                <TableRow>
                  <TableCell colSpan={compact ? 3 : 4} className='text-muted-foreground py-8 text-center'>
                    Compute the parent payrun to generate the salary breakdown.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {computed && (
            <div className='bg-muted/20 grid gap-4 border-t p-4 sm:grid-cols-3'>
              {totals.map(([label, amount]) => (
                <div key={label}>
                  <p className='text-muted-foreground text-xs'>{label}</p>
                  <p className={`mt-1 text-base font-semibold tabular-nums ${label === 'Net salary' ? 'text-primary' : ''}`}>
                    {money(amount, slip.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
      <PayrollWarnings warnings={slip.warnings} title='Payslip warnings' />
      {slip.contractSnapshot && (
        <section>
          <h2 className='mb-2 text-sm font-semibold'>Contract used for this period</h2>
          <Facts
            items={[
              ['Monthly wage', money(slip.contractSnapshot.wage, slip.currency)],
              ['Effective dates', `${formatDate(slip.contractSnapshot.startDate)} – ${formatDate(slip.contractSnapshot.endDate)}`],
              ['Employment type', EMPLOYMENT_TYPES[slip.contractSnapshot.employmentType]]
            ]}
          />
          <p className='text-muted-foreground mt-2 text-xs'>
            {isLocked(slip.status)
              ? 'This snapshot is preserved with the finalized payslip.'
              : 'Recomputing refreshes this snapshot from the applicable contract.'}
          </p>
        </section>
      )}
      {slip.bankSnapshot && (
        <section>
          <h2 className='mb-2 text-sm font-semibold'>Bank transfer</h2>
          <Facts
            items={[
              ['Bank', slip.bankSnapshot.bankName || 'Not set'],
              ['Account', `•••• ${slip.bankSnapshot.accountNumberLast4}`],
              ['IFSC', slip.bankSnapshot.ifsc]
            ]}
          />
        </section>
      )}
    </div>
  )
}
