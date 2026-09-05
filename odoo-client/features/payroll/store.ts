import { create } from '@/features/nexacrm/adapters/native-store'
import { useEmployeesStore } from '@/features/employees/store'
import { payrollAttendanceInputs } from './attendance-input'
import { useSchedulesStore } from '@/features/working-schedules/store'
import { useTimeOffStore } from '@/features/time-off/store'
import { getPayrollPermissions } from './permissions'
import { DATA_API_CONNECTED, DATA_CONNECTION_MESSAGE } from '@/features/hr/data-availability'
import { computePayslip, eligibleEmployees, periodError, validateRules, FORMULA_VARIABLES } from './engine'
import { payrollContractInputs } from './contract-input'
import { RULE_CATEGORIES, COMPUTATION_METHODS } from './types'
import type { SalaryRule, SalaryRuleInput, SalaryStructure, SalaryStructureInput, Payrun, PayrunInput, Payslip, PayrollResult } from './types'
type PayrollStore = {
  rules: SalaryRule[]; structures: SalaryStructure[]; payruns: Payrun[]; payslips: Payslip[]; bankDetails: Record<string, string>
  saveRule: (input: SalaryRuleInput, id?: string) => PayrollResult; removeRule: (id: string) => PayrollResult
  saveStructure: (input: SalaryStructureInput, id?: string, ruleUpdates?: SalaryRule[]) => PayrollResult; removeStructure: (id: string) => PayrollResult
  updatePayrun: (id: string, input: PayrunInput) => PayrollResult; removePayslip: (id: string) => PayrollResult; createPayrun: (input: PayrunInput) => PayrollResult; computePayrun: (id: string) => PayrollResult; validatePayrun: (id: string) => PayrollResult; markPaid: (id: string) => PayrollResult; removePayrun: (id: string) => PayrollResult
  setBankDetails: (employeeId: string, account: string) => PayrollResult
}
const fail = (error: string): PayrollResult => ({ ok: false, error })
const denied = () => fail(DATA_API_CONNECTED ? 'Your role does not allow this payroll action.' : DATA_CONNECTION_MESSAGE)
const locked = (run: Payrun) => run.status === 'validated' || run.status === 'paid'
export const usePayrollStore = create<PayrollStore>()((set, get) => ({
  rules: [], structures: [], payruns: [], payslips: [], bankDetails: {},
  saveRule: (raw, id) => {
    if (!getPayrollPermissions().canConfigure) return denied()
    if (id && !get().rules.some(rule => rule.id === id)) return fail('Rule no longer exists.')
    const input = { ...raw, name: raw.name.trim(), code: raw.code.trim().toUpperCase() }
    if (!input.name || !/^[A-Z][A-Z0-9_]*$/.test(input.code) || FORMULA_VARIABLES.includes(input.code)) return fail('Enter a name and a unique non-reserved uppercase rule code.')
    if (!Object.hasOwn(RULE_CATEGORIES, input.category) || !Object.hasOwn(COMPUTATION_METHODS, input.method)) return fail('Choose a valid category and computation method.')
    if (!Number.isInteger(input.sequence) || input.sequence < 0 || !Number.isFinite(input.amount) || input.amount < 0 || !Number.isFinite(input.percentage) || input.percentage < 0) return fail('Sequence and amounts must be valid non-negative numbers.')
    if (get().rules.some(rule => rule.id !== id && rule.code === input.code)) return fail('A salary rule already uses this code.')
    const rule = { ...input, id: id || 'rule_' + crypto.randomUUID() }
    const rules = id ? get().rules.map(item => item.id === id ? rule : item) : [...get().rules, rule]
    // Check the edited rule against available prior codes; each structure is checked again on save/compute.
    const error = validateRules(rules.filter(item => item.active), false)
    if (error) return fail(error)
    for (const structure of get().structures) { const structureError = validateRules(rules.filter(item => item.active && structure.ruleIds.includes(item.id))); if (structureError) return fail(`${structure.name}: ${structureError}`) }
    set({ rules }); return { ok: true, id: rule.id }
  },
  removeRule: id => {
    if (!getPayrollPermissions().canConfigure) return denied()
    if (get().structures.some(structure => structure.ruleIds.includes(id))) return fail('Remove this rule from its salary structures first.')
    set({ rules: get().rules.filter(rule => rule.id !== id) }); return { ok: true, id }
  },
  saveStructure: (raw, id, ruleUpdates = []) => {
    if (!getPayrollPermissions().canConfigure) return denied()
    if (id && !get().structures.some(item => item.id === id)) return fail('Structure no longer exists.')
    const input = { ...raw, name: raw.name.trim(), description: raw.description.trim(), ruleIds: [...new Set(raw.ruleIds)] }
    if (!input.name || !input.ruleIds.length) return fail('Enter a name and include at least one salary rule.')
    if (get().structures.some(item => item.id !== id && item.name.toLowerCase() === input.name.toLowerCase())) return fail('A structure already uses this name.')
    if (input.ruleIds.some(ruleId => !get().rules.some(rule => rule.id === ruleId))) return fail('Choose existing salary rules.')
    if (ruleUpdates.some(rule => !Number.isInteger(rule.sequence) || rule.sequence < 0 || !get().rules.some(existing => existing.id === rule.id))) return fail('Use existing rules with a valid non-negative sequence.')
    const rules = get().rules.map(rule => ({ ...rule, sequence: ruleUpdates.find(update => update.id === rule.id)?.sequence ?? rule.sequence }))
    const error = validateRules(rules.filter(rule => rule.active && input.ruleIds.includes(rule.id))); if (error) return fail(error)
    for (const other of get().structures.filter(item => item.id !== id)) { const issue = validateRules(rules.filter(rule => rule.active && other.ruleIds.includes(rule.id))); if (issue) return fail(`${other.name}: ${issue}`) }
    const structure = { ...input, id: id || 'structure_' + crypto.randomUUID() }
    set({ rules, structures: id ? get().structures.map(item => item.id === id ? structure : item) : [...get().structures, structure] }); return { ok: true, id: structure.id }
  },
  removeStructure: id => {
    if (!getPayrollPermissions().canConfigure) return denied()
    const structure = get().structures.find(item => item.id === id)
    if (get().payruns.some(run => run.structureId === id) || payrollContractInputs.some(contract => contract.salaryStructure === id || contract.salaryStructure.toLowerCase() === structure?.name.toLowerCase())) return fail('This structure is referenced by a contract or payrun. Archive it by switching Active off.')
    set({ structures: get().structures.filter(item => item.id !== id) }); return { ok: true, id }
  },
  createPayrun: input => {
    if (!getPayrollPermissions().canProcess) return denied()
    const error = periodError(input.startDate, input.endDate); if (error) return fail(error)
    if (!input.name.trim()) return fail('Enter a payrun name.')
    const structure = get().structures.find(item => item.id === input.structureId && item.active); if (!structure) return fail('Choose an active salary structure.')
    if (!input.employeeIds.length || new Set(input.employeeIds).size !== input.employeeIds.length) return fail('Select one or more distinct employees.')
    const eligible = eligibleEmployees(useEmployeesStore.getState().employees, payrollContractInputs, structure, input.startDate, input.endDate)
    if (input.employeeIds.some(id => !eligible.some(employee => employee.id === id))) return fail('Selected employees must have a matching active contract covering the full period. Refresh the employee selection.')
    const run: Payrun = { ...input, name: input.name.trim(), employeeIds: [...input.employeeIds], id: 'run_' + crypto.randomUUID(), structureName: structure.name, status: 'draft', createdAt: new Date().toISOString(), warnings: [] }
    set({ payruns: [run, ...get().payruns] }); return { ok: true, id: run.id }
  },
  updatePayrun: (id, input) => {
    if (!getPayrollPermissions().canProcess) return denied()
    const run = get().payruns.find(item => item.id === id)
    if (!run || locked(run)) return fail('Only draft or computed payruns can be edited.')
    const error = periodError(input.startDate, input.endDate); if (error) return fail(error)
    const structure = get().structures.find(item => item.id === input.structureId && item.active)
    if (!structure || !input.name.trim()) return fail('Enter a name and choose an active salary structure.')
    const eligible = eligibleEmployees(useEmployeesStore.getState().employees, payrollContractInputs, structure, input.startDate, input.endDate)
    if (!input.employeeIds.length || new Set(input.employeeIds).size !== input.employeeIds.length || input.employeeIds.some(employeeId => !eligible.some(employee => employee.id === employeeId))) return fail('Select eligible employees with full-period matching contracts.')
    set({ payruns: get().payruns.map(item => item.id === id ? { ...item, structureId: input.structureId, startDate: input.startDate, endDate: input.endDate, name: input.name.trim(), employeeIds: [...input.employeeIds], structureName: structure.name, status: 'draft', computedAt: undefined, warnings: [] } : item), payslips: get().payslips.filter(slip => slip.payrunId !== id) })
    return { ok: true, id }
  },
  removePayslip: id => {
    if (!getPayrollPermissions().canDelete) return denied()
    const slip = get().payslips.find(item => item.id === id)
    const run = get().payruns.find(item => item.id === slip?.payrunId)
    if (!slip || !run || locked(run)) return fail('Only unvalidated payslips can be deleted.')
    if (run.employeeIds.length <= 1) return fail('Delete the payrun to remove its last payslip.')
    set({ payruns: get().payruns.map(item => item.id === run.id ? { ...item, employeeIds: item.employeeIds.filter(employeeId => employeeId !== slip.employeeId), status: 'draft', computedAt: undefined, warnings: [] } : item), payslips: get().payslips.filter(item => item.payrunId !== run.id) })
    return { ok: true, id: run.id }
  },
  computePayrun: id => {
    if (!getPayrollPermissions().canProcess) return denied()
    const run = get().payruns.find(item => item.id === id); if (!run) return fail('Payrun no longer exists.'); if (locked(run)) return fail('Validated and paid payroll is immutable history.')
    const structure = get().structures.find(item => item.id === run.structureId); if (!structure) return fail('Salary structure no longer exists.')
    const schedules = useSchedulesStore.getState()
    const payslips = run.employeeIds.map(employeeId => computePayslip(run, employeeId, structure, get().rules, { employees: useEmployeesStore.getState().employees, contracts: payrollContractInputs, attendance: payrollAttendanceInputs, schedules: schedules.schedules, assignments: schedules.assignments, bankDetails: get().bankDetails, existingPayslips: get().payslips, timeOff: useTimeOffStore.getState() }))
    set({ payslips: [...get().payslips.filter(slip => slip.payrunId !== id), ...payslips], payruns: get().payruns.map(item => item.id === id ? { ...item, status: 'computed', computedAt: new Date().toISOString(), warnings: payslips.flatMap(slip => slip.warnings) } : item) }); return { ok: true, id }
  },
  validatePayrun: id => {
    if (!getPayrollPermissions().canProcess) return denied()
    const run = get().payruns.find(item => item.id === id); if (!run || run.status !== 'computed') return fail('Compute this payrun before validating it.')
    const before = JSON.stringify(get().payslips.filter(slip => slip.payrunId === id))
    const result = get().computePayrun(id); if (!result.ok) return result
    if (get().payruns.find(item => item.id === id)!.warnings.some(warning => warning.blocking)) return fail('Resolve blocking warnings and compute again before validation.')
    if (before !== JSON.stringify(get().payslips.filter(slip => slip.payrunId === id))) return fail('Payroll inputs changed. Review the refreshed computation, then validate again.')
    set({ payruns: get().payruns.map(item => item.id === id ? { ...item, status: 'validated', validatedAt: new Date().toISOString() } : item), payslips: get().payslips.map(slip => slip.payrunId === id ? { ...slip, status: 'validated' } : slip) }); return { ok: true, id }
  },
  markPaid: id => {
    if (!getPayrollPermissions().canProcess) return denied()
    if (get().payruns.find(item => item.id === id)?.status !== 'validated') return fail('Validate this payrun before marking it paid.')
    set({ payruns: get().payruns.map(item => item.id === id ? { ...item, status: 'paid', paidAt: new Date().toISOString() } : item), payslips: get().payslips.map(slip => slip.payrunId === id ? { ...slip, status: 'paid' } : slip) }); return { ok: true, id }
  },
  removePayrun: id => {
    if (!getPayrollPermissions().canDelete) return denied()
    const run = get().payruns.find(item => item.id === id); if (!run) return fail('Payrun no longer exists.'); if (locked(run)) return fail('Validated and paid payroll is preserved as immutable history.')
    set({ payruns: get().payruns.filter(item => item.id !== id), payslips: get().payslips.filter(slip => slip.payrunId !== id) }); return { ok: true, id }
  },
  setBankDetails: (employeeId, account) => {
    if (!getPayrollPermissions().canProcess) return denied()
    if (!useEmployeesStore.getState().employees.some(employee => employee.id === employeeId)) return fail('Employee no longer exists.')
    if (account.trim().length < 4) return fail('Enter a payment account with at least four characters.')
    set({ bankDetails: { ...get().bankDetails, [employeeId]: account.trim() } }); return { ok: true, id: employeeId }
  },
}))
