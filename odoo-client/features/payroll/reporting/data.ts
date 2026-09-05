import type { Employee } from '@/features/employees/types'
import type { PayrollContractInput } from '../contract-input'
import type { PayrollAttendanceInput as Attendance } from '../attendance-input'
import { workedMinutes } from '../attendance-input'
import type { WorkingSchedule } from '@/features/working-schedules/types'
import { slotMinutes, timeMinutes } from '@/features/working-schedules/types'
import type { TimeOffData } from '@/features/time-off/model'
import { employeeBalance } from '@/features/time-off/logic'
import type { Payrun, Payslip } from '../types'

export type ReportFilters = { from: string; to: string; department: string; employmentType: string; currency: string }
export type ReportSources = { employees: Employee[]; contracts: PayrollContractInput[]; attendance: Attendance[]; schedules: WorkingSchedule[]; assignments: Record<string, string>; leave: TimeOffData; payruns: Payrun[]; payslips: Payslip[] }
const overlap = (start: string, end: string, from: string, to: string) => start <= to && end >= from
export function payrollReport(source: ReportSources, filter: ReportFilters, today: string) {
  const periodContracts = source.contracts.filter(contract => contract.state === 'active' && overlap(contract.startDate, contract.endDate || '9999-12-31', filter.from, filter.to))
  const departmentOf = (employee: Employee) => employee.department || periodContracts.find(contract => contract.employeeId === employee.id)?.department || 'Not assigned'
  const departments = [...new Set([...source.employees.map(departmentOf), ...source.payslips.map(slip => slip.department || 'Not assigned')])].sort()
  const employees = source.employees.filter(employee => (filter.department === 'all' || departmentOf(employee) === filter.department) && (filter.employmentType === 'all' || employee.employmentType === filter.employmentType))
  const employeeIds = new Set(employees.map(employee => employee.id))
  // Historical payslips use their snapshot department/type even if today's employee record changes.
  const slips = source.payslips.filter(slip => overlap(slip.startDate, slip.endDate, filter.from, filter.to) && slip.currency === filter.currency && (filter.department === 'all' || slip.department === filter.department) && (filter.employmentType === 'all' || slip.employmentType === filter.employmentType))
  const paid = slips.filter(slip => slip.status === 'paid')
  const netPaid = paid.reduce((sum, slip) => sum + slip.net, 0)
  const costs = new Map<string, { department: string; headcount: number; net: number }>()
  employees.forEach(employee => { const name = departmentOf(employee); const row = costs.get(name) || { department: name, headcount: 0, net: 0 }; row.headcount++; costs.set(name, row) })
  paid.forEach(slip => { const name = slip.department || 'Not assigned'; const row = costs.get(name) || { department: name, headcount: 0, net: 0 }; row.net += slip.net; costs.set(name, row) })
  const monthly = new Map<string, number>()
  paid.forEach(slip => monthly.set(slip.endDate.slice(0, 7), (monthly.get(slip.endDate.slice(0, 7)) || 0) + slip.net))
  const requests = source.leave.requests.filter(request => employeeIds.has(request.employeeId) && overlap(request.startDate, request.endDate, filter.from, filter.to))
  const approved = requests.filter(request => request.status === 'approved')
  let approvedDays = 0, approvedHours = 0, unpaidDays = 0, unpaidHours = 0
  approved.forEach(request => {
    const quantity = request.charges.filter(charge => charge.date >= filter.from && charge.date <= filter.to).reduce((sum, charge) => sum + charge.amount, 0)
    if (request.unit === 'days') approvedDays += quantity; else approvedHours += quantity
    if (source.leave.types.find(type => type.id === request.typeId)?.payroll === 'unpaid') { if (request.unit === 'days') unpaidDays += quantity; else unpaidHours += quantity }
  })
  // Historical balances exclude charges after the selected reporting period.
  const balanceSource = { ...source.leave, requests: source.leave.requests.map(request => ({ ...request, consumptions: request.consumptions.filter(charge => charge.date <= filter.to), duration: request.charges.filter(charge => charge.date <= filter.to).reduce((sum, charge) => sum + charge.amount, 0) })) }
  let balanceDays = 0, balanceHours = 0
  employees.forEach(employee => source.leave.types.forEach(type => {
    const remaining = employeeBalance(balanceSource, employee.id, type.id, filter.to).remaining
    if (type.unit === 'days') balanceDays += remaining; else balanceHours += remaining
  }))
  const attendance = source.attendance.filter(record => employeeIds.has(record.employeeId) && record.checkIn.slice(0, 10) >= filter.from && record.checkIn.slice(0, 10) <= filter.to && record.checkIn.slice(0, 10) <= today)
  const presence = new Map<string, { minutes: number; first: string; complete: boolean }>()
  attendance.forEach(record => {
    const key = record.employeeId + ':' + record.checkIn.slice(0, 10)
    const row = presence.get(key) || { minutes: 0, first: record.checkIn, complete: true }
    row.minutes += Math.max(0, workedMinutes(record) || 0)
    row.first = row.first < record.checkIn ? row.first : record.checkIn
    row.complete &&= Boolean(record.checkOut)
    presence.set(key, row)
  })
  let scheduled = 0, covered = 0, absent = 0, late = 0, overtimeMinutes = 0, withoutSchedule = 0
  for (const employee of employees) {
    const assignment = source.assignments[employee.id]
    const end = filter.to < today ? filter.to : today
    let foundSchedule = false
    for (let date = filter.from; date <= end;) {
      const contract = periodContracts.find(item => item.employeeId === employee.id && item.startDate <= date && (!item.endDate || item.endDate >= date))
      const schedule = source.schedules.find(item => item.id === contract?.workingSchedule || item.name === contract?.workingSchedule) || source.schedules.find(item => item.id === assignment)
      if (schedule) {
        foundSchedule = true
        const instant = new Date(date + 'T12:00:00Z')
        const slots = schedule.slots.filter(slot => slot.day === (instant.getUTCDay() + 6) % 7)
        if (slots.length) {
          const leave = approved.some(request => request.employeeId === employee.id && request.unit === 'days' && request.charges.some(charge => charge.date === date && charge.amount >= 1))
          const row = presence.get(employee.id + ':' + date)
          const expected = slots.reduce((sum, slot) => sum + slotMinutes(slot), 0)
          scheduled++
          if (row?.complete || leave) covered++
          if (!row && !leave && date < today) absent++
          if (row) {
            if (timeMinutes(row.first.slice(11, 16)) > Math.min(...slots.map(slot => timeMinutes(slot.start)))) late++
            overtimeMinutes += Math.max(0, row.minutes - expected)
          }
        }
      }
      const next = new Date(date + 'T12:00:00Z'); next.setUTCDate(next.getUTCDate() + 1); date = next.toISOString().slice(0, 10)
    }
    if (!foundSchedule) withoutSchedule++
  }
  const scopedSlipRunIds = new Set(slips.map(slip => slip.payrunId))
  const draftEmployeeIds = new Set(employees.filter(employee => periodContracts.some(contract => contract.employeeId === employee.id && contract.currency === filter.currency)).map(employee => employee.id))
  const scopedRuns = source.payruns.filter(run => overlap(run.startDate, run.endDate, filter.from, filter.to) && (scopedSlipRunIds.has(run.id) || (run.status === 'draft' && run.employeeIds.some(id => draftEmployeeIds.has(id)))))
  const warnings = scopedRuns.flatMap(run => {
    const scopedIds = run.status === 'draft' ? draftEmployeeIds : new Set(slips.filter(slip => slip.payrunId === run.id).map(slip => slip.employeeId))
    return run.warnings.filter(warning => !warning.employeeId || scopedIds.has(warning.employeeId)).map(warning => ({ ...warning, runId: run.id, runName: run.name }))
  })
  const noContract = employees.filter(employee => { const applicable = periodContracts.filter(contract => contract.employeeId === employee.id); return applicable.length !== 1 || applicable[0].startDate > filter.from || Boolean(applicable[0].endDate && applicable[0].endDate < filter.to) }).length
  return { departments, employees, slips, paid, netPaid, average: paid.length ? netPaid / paid.length : 0, costs: [...costs.values()].sort((a, b) => b.net - a.net), trends: [...monthly].sort(([a], [b]) => a.localeCompare(b)).map(([month, net]) => ({ month, net })), approvedDays, approvedHours, unpaidDays, unpaidHours, balanceDays, balanceHours, pending: requests.filter(request => request.status === 'pending').length, attendance: { present: presence.size, late, absent, overtimeMinutes, missing: attendance.filter(record => !record.checkOut && record.checkIn.slice(0, 10) < today).length, manualEdits: attendance.filter(record => record.corrections.length > 0).length, scheduled, covered, coverage: scheduled ? Math.round(covered / scheduled * 100) : null, withoutSchedule }, warnings, noContract, runs: scopedRuns }
}
