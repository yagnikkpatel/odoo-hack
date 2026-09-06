import type { Employee } from '@/features/employees/types'
import { employeeName } from '@/features/employees/types'
import type { PayrollContractInput } from './contract-input'
import { payrollContractForPeriod } from './contract-input'
import type { PayrollAttendanceInput as Attendance } from './attendance-input'
import { workedMinutes } from './attendance-input'
import type { WorkingSchedule } from '@/features/working-schedules/types'
import { slotMinutes } from '@/features/working-schedules/types'
import type { TimeOffData } from '@/features/time-off/model'
import type { Payrun, Payslip, SalaryRule, SalaryStructure, PayrollWarning } from './types'
export const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export const FORMULA_VARIABLES = ['WAGE', 'WORKED_DAYS', 'WORKED_HOURS', 'OVERTIME_HOURS', 'EXPECTED_DAYS', 'EXPECTED_HOURS', 'UNPAID_DAYS', 'PERIOD_DAYS']
/** Small arithmetic parser; never executes JavaScript or resolves object properties. */
export function evaluateFormula(source: string, variables: Record<string, number>): number {
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[A-Za-z_][A-Za-z_0-9]*|[()+\-*/]/g) || []
  if (!source.trim() || tokens.join('') !== source.replace(/\s/g, '') || tokens.length > 200) throw new Error('Use numbers, known codes, parentheses and + − * / only.')
  let index = 0
  function atom(): number {
    const token = tokens[index++]
    if (token === '+') return atom()
    if (token === '-') return -atom()
    if (token === '(') { const result = expression(); if (tokens[index++] !== ')') throw new Error('Unclosed parentheses.'); return result }
    if (token && /^(?:\d|\.)/.test(token)) return Number(token)
    if (token && Object.hasOwn(variables, token)) return variables[token]
    throw new Error(`Unknown or unavailable formula code: ${token || 'end of formula'}.`)
  }
  function product(): number { let value = atom(); while (tokens[index] === '*' || tokens[index] === '/') { const op = tokens[index++]; const right = atom(); if (op === '/' && right === 0) throw new Error('Division by zero.'); value = op === '*' ? value * right : value / right }; return value }
  function expression(): number { let value = product(); while (tokens[index] === '+' || tokens[index] === '-') { const op = tokens[index++]; const right = product(); value = op === '+' ? value + right : value - right }; return value }
  const result = expression()
  if (index !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid arithmetic expression.')
  return result
}
export function periodError(start: string, end: string): string | undefined {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date
  if (!valid(start) || !valid(end) || start > end) return 'Choose a valid payroll period.'
  if ((Date.parse(end) - Date.parse(start)) / 86400000 > 366) return 'Payroll periods cannot exceed one year.'
}
export function periodContract(contracts: PayrollContractInput[], employeeId: string, start: string, end: string) {
  const error = periodError(start, end); if (error) throw new Error(error)
  const contract = payrollContractForPeriod(contracts, employeeId, start, end)
  if (!contract) throw new Error('No active contract applies to this payroll period.')
  if (contract.startDate > start || (contract.endDate && contract.endDate < end)) throw new Error('Contract does not cover the full period. Split the payroll period.')
  return contract
}
export function eligibleEmployees(employees: Employee[], contracts: PayrollContractInput[], structure: SalaryStructure, start: string, end: string) {
  return employees.filter(employee => { if (employee.status === 'inactive') return false; try { const contract = periodContract(contracts, employee.id, start, end); return contract.salaryStructure === structure.id || contract.salaryStructure.toLowerCase() === structure.name.toLowerCase() } catch { return false } })
}
export function validateRules(rules: SalaryRule[], uniqueSequences = true): string | undefined {
  if (uniqueSequences && new Set(rules.map(rule => rule.sequence)).size !== rules.length) return 'Each active rule in a structure must have a unique execution sequence.'
  const codes = new Set(FORMULA_VARIABLES)
  const context: Record<string, number> = Object.fromEntries(FORMULA_VARIABLES.map(code => [code, 1]))
  for (const rule of [...rules].sort((a, b) => a.sequence - b.sequence)) {
    if (codes.has(rule.code)) return `Duplicate or reserved rule code: ${rule.code}.`
    try { if (rule.method !== 'fixed') evaluateFormula(rule.method === 'percentage' ? rule.base : rule.formula, context) } catch (error) { return `${rule.name}: ${(error as Error).message}` }
    codes.add(rule.code); context[rule.code] = 1
  }
}
export type ComputeContext = { employees: Employee[]; contracts: PayrollContractInput[]; attendance: Attendance[]; schedules: WorkingSchedule[]; assignments: Record<string, string>; bankDetails: Record<string, string>; existingPayslips: Payslip[]; timeOff?: TimeOffData }
export function computePayslip(run: Payrun, employeeId: string, structure: SalaryStructure, allRules: SalaryRule[], context: ComputeContext): Payslip {
  const employee = context.employees.find(item => item.id === employeeId)
  const warnings: PayrollWarning[] = []
  const warn = (code: string, message: string, blocking = true) => warnings.push({ code, message, employeeId, blocking })
  const slip: Payslip = { id: `slip_${run.id}_${employeeId}`, payrunId: run.id, employeeId, employeeName: employee ? employeeName(employee) : 'Deleted employee', employeeEmail: employee?.email || '', department: employee?.department || 'Unassigned', employmentType: employee?.employmentType || '', structureId: structure.id, structureName: structure.name, startDate: run.startDate, endDate: run.endDate, status: 'computed', currency: 'INR', workedDays: 0, workedHours: 0, expectedDays: 0, expectedHours: 0, basic: 0, allowances: 0, deductions: 0, contributions: 0, gross: 0, net: 0, lines: [], warnings, bankAccount: context.bankDetails[employeeId] }
  if (!employee) warn('employee', 'The selected employee no longer exists.')
  if (!slip.bankAccount?.trim()) warn('bank', 'Bank details are missing. Add a payment account before validation.')
  if (!employee?.email) warn('email', 'Work email is missing; payslip delivery is unavailable.', false)
  if (context.existingPayslips.some(other => other.payrunId !== run.id && other.employeeId === employeeId && other.startDate <= run.endDate && other.endDate >= run.startDate)) warn('duplicate', 'Another payslip already overlaps this payroll period.')
  let contract: PayrollContractInput
  try { contract = periodContract(context.contracts, employeeId, run.startDate, run.endDate) } catch (error) { warn('contract', (error as Error).message); return slip }
  slip.contractSnapshot = { ...contract }; slip.currency = contract.currency; slip.department = contract.department
  if (contract.salaryStructure !== structure.id && contract.salaryStructure.toLowerCase() !== structure.name.toLowerCase()) warn('structure', 'The contract salary structure differs from this payrun.')
  const scheduleKey = contract.workingSchedule || context.assignments[employeeId]
  const schedule = context.schedules.find(item => item.id === scheduleKey || item.name.toLowerCase() === scheduleKey?.toLowerCase()) || context.schedules.find(item => item.id === context.assignments[employeeId])
  if (!schedule) warn('schedule', 'No working schedule is assigned; expected days and hours are unavailable.', false)
  let monthlyFactor = 0
  for (let time = Date.parse(run.startDate); time <= Date.parse(run.endDate); time += 86400000) {
    const date = new Date(time); const daysInMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(); monthlyFactor += 1 / daysInMonth
    const slots = schedule?.slots.filter(slot => slot.day === (date.getUTCDay() + 6) % 7) || []
    if (slots.length) slip.expectedDays++
    slip.expectedHours += slots.reduce((sum, slot) => sum + slotMinutes(slot) / 60, 0)
  }
  const attendance = context.attendance.filter(item => item.employeeId === employeeId && item.checkIn.slice(0, 10) >= run.startDate && item.checkIn.slice(0, 10) <= run.endDate)
  slip.workedDays = new Set(attendance.filter(item => item.checkOut).map(item => item.checkIn.slice(0, 10))).size
  slip.workedHours = round(attendance.reduce((sum, item) => sum + Math.max(0, workedMinutes(item) || 0) / 60, 0))
  if (attendance.some(item => !item.checkOut)) warn('attendance', 'Attendance contains missing check-outs. Review worked hours.', contract.wagePeriod === 'hour')
  const periodDays = (Date.parse(run.endDate) - Date.parse(run.startDate)) / 86400000 + 1
  const unpaidDays = (context.timeOff?.requests || []).filter(item => item.employeeId === employeeId && item.status === 'approved' && context.timeOff?.types.find(type => type.id === item.typeId)?.payroll === 'unpaid').reduce((sum, item) => sum + item.charges.filter(charge => charge.date >= run.startDate && charge.date <= run.endDate).reduce((total, charge) => total + charge.amount / (item.unit === 'hours' ? (slip.expectedHours / slip.expectedDays || 8) : 1), 0), 0)
  const variables: Record<string, number> = { WAGE: round(contract.wagePeriod === 'hour' ? contract.wage * slip.workedHours : contract.wage * monthlyFactor / (contract.wagePeriod === 'year' ? 12 : 1)), WORKED_DAYS: slip.workedDays, WORKED_HOURS: slip.workedHours, EXPECTED_DAYS: slip.expectedDays, EXPECTED_HOURS: slip.expectedHours, PERIOD_DAYS: periodDays, UNPAID_DAYS: contract.wagePeriod === 'hour' ? 0 : unpaidDays }
  const rules = structure.ruleIds.map(id => allRules.find(rule => rule.id === id)).filter((rule): rule is SalaryRule => !!rule && rule.active).sort((a, b) => a.sequence - b.sequence)
  if (!rules.length) { warn('rules', 'The salary structure has no active rules.'); return slip }
  if (structure.ruleIds.some(id => !allRules.some(rule => rule.id === id))) warn('rules', 'The salary structure references a missing rule.')
  const rulesError = validateRules(rules)
  if (rulesError) { warn('rules', rulesError); return slip }
  for (const rule of rules) {
    try {
      const amount = round(rule.method === 'fixed' ? rule.amount : rule.method === 'percentage' ? evaluateFormula(rule.base, variables) * rule.percentage / 100 : evaluateFormula(rule.formula, variables))
      if (!Number.isFinite(amount)) throw new Error('Amount is not finite.')
      variables[rule.code] = amount; slip.lines.push({ ruleId: rule.id, name: rule.name, code: rule.code, category: rule.category, sequence: rule.sequence, amount })
    } catch (error) { warn('formula', `${rule.name}: ${(error as Error).message}`); break }
  }
  const total = (category: string) => round(slip.lines.filter(line => line.category === category).reduce((sum, line) => sum + line.amount, 0))
  slip.basic = total('basic'); slip.allowances = total('allowance'); slip.deductions = total('deduction'); slip.contributions = total('contribution'); slip.gross = slip.lines.some(line => line.category === 'gross') ? total('gross') : round(slip.basic + slip.allowances); slip.net = slip.lines.some(line => line.category === 'net') ? total('net') : round(slip.gross - slip.deductions)
  if (slip.net < 0) warn('negative', 'Net salary is negative. Review salary rules.')
  return slip
}
