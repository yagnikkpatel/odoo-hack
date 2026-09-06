import { create } from '@/features/nexacrm/adapters/native-store'
import { payrollAccess, type Actor } from '@/features/auth/permissions'
import { getPayrollPermissions } from './permissions'
import * as service from './service'
import type { SalaryRule, SalaryRuleInput, SalaryStructure, SalaryStructureInput, Payrun, PayrunInput, Payslip, PayrollResult } from './types'

type PayrollStore = {
  rules: SalaryRule[]; structures: SalaryStructure[]; payruns: Payrun[]; payslips: Payslip[]; bankDetails: Record<string, string>
  hasHydrated: boolean; isLoading: boolean; error: string | null; owner: Actor | null; ownerKey: string
  load: (actor: Actor, force?: boolean) => Promise<void>
  saveRule: (input: SalaryRuleInput, id?: string) => Promise<PayrollResult>
  removeRule: (id: string) => Promise<PayrollResult>
  saveStructure: (input: SalaryStructureInput, id?: string, rules?: SalaryRule[]) => Promise<PayrollResult>
  removeStructure: (id: string) => Promise<PayrollResult>
  createPayrun: (input: PayrunInput) => Promise<PayrollResult>
  updatePayrun: (id: string, input: PayrunInput) => Promise<PayrollResult>
  computePayrun: (id: string) => Promise<PayrollResult>
  validatePayrun: (id: string) => Promise<PayrollResult>
  markPaid: (id: string) => Promise<PayrollResult>
  removePayrun: (id: string) => Promise<PayrollResult>
  removePayslip: (id: string) => Promise<PayrollResult>
  setBankDetails: (id: string, account: string) => Promise<PayrollResult>
}

export const payrollErrorMessage = (cause: unknown) => cause instanceof Error ? cause.message : 'Payroll could not be loaded. Please try again.'
const empty = { rules: [], structures: [], payruns: [], payslips: [], bankDetails: {} }
let version = 0
let controller: AbortController | undefined

/** Restores the API-backed store from 961f701 using the current paginated API. */
export const usePayrollStore = create<PayrollStore>()((set, get) => {
  async function mutate(allowed: boolean, write: () => Promise<string>): Promise<PayrollResult> {
    if (!allowed) return { ok: false, error: 'Your role does not allow this payroll action.' }
    const owner = get().owner
    const ownerKey = get().ownerKey
    ++version
    controller?.abort()
    try {
      const id = await write()
      // A confirmed write stays successful even if refreshing its table fails.
      if (owner && get().ownerKey === ownerKey) await get().load(owner, true)
      return { ok: true, id }
    } catch (cause) {
      // Validation may recompute before refusing a lock; refresh the actual state.
      if (owner && get().ownerKey === ownerKey) await get().load(owner, true)
      return { ok: false, error: payrollErrorMessage(cause) }
    }
  }
  const ruleInput = (input: SalaryRuleInput): SalaryRuleInput => {
    const { name, code, category, sequence, method, amount, percentage, base, formula, quantity, active } = input
    return { name, code, category, sequence, method, amount, percentage, base, formula, quantity: quantity ?? 1, active }
  }
  return {
    ...empty, hasHydrated: false, isLoading: false, error: null, owner: null, ownerKey: '',
    async load(actor, force = false) {
      const key = JSON.stringify(actor)
      if (!force && get().ownerKey === key && (get().isLoading || get().hasHydrated)) return
      const current = ++version
      controller?.abort()
      controller = new AbortController()
      const signal = controller.signal
      const access = payrollAccess(actor)
      set({ ...(get().ownerKey !== key ? { ...empty, hasHydrated: false } : {}), owner: actor, ownerKey: key, isLoading: true, error: null })
      try {
        const [rules, structures, payruns, payslips] = await Promise.all([
          access.canReadRules ? service.listSalaryRules(signal) : [],
          access.canReadStructures ? service.listSalaryStructures(signal) : [],
          access.canReadPayruns ? service.collectPayrollPages(async offset => {
            const page = await service.listPayruns({ limit: 100, offset }, signal)
            return { items: page.payruns, pagination: page.pagination }
          }) : [],
          access.canReadPayslips ? service.collectPayrollPages(async offset => {
            const page = await service.listPayslips({ limit: 200, offset }, signal)
            return { items: page.payslips, pagination: page.pagination }
          }) : [],
        ])
        if (current !== version || signal.aborted) return
        set({ rules, structures, payruns, payslips, bankDetails: Object.fromEntries(payslips.filter(slip => slip.bankAccount).map(slip => [slip.employeeId, slip.bankAccount!])), hasHydrated: true, isLoading: false, error: null })
      } catch (cause) {
        if (current !== version || signal.aborted) return
        set({ hasHydrated: true, isLoading: false, error: payrollErrorMessage(cause) })
      }
    },
    saveRule: (input, id) => mutate(id ? getPayrollPermissions().canConfigureRules : getPayrollPermissions().canCreateRules, async () => (id ? await service.updateSalaryRule(id, ruleInput(input)) : await service.createSalaryRule(ruleInput(input))).id),
    removeRule: id => mutate(getPayrollPermissions().canDeleteRules, async () => { await service.deleteSalaryRule(id); return id }),
    saveStructure: (input, id, rules = []) => mutate(id ? getPayrollPermissions().canConfigureStructures : getPayrollPermissions().canCreateStructures, async () => {
      const { name, description, active, ruleIds } = input
      const body = { name, description, active, ruleIds }
      const sequences = rules.map(rule => ({ id: rule.id, sequence: rule.sequence }))
      return (id ? await service.updateSalaryStructure(id, body, sequences) : await service.createSalaryStructure(body, sequences)).id
    }),
    removeStructure: id => mutate(getPayrollPermissions().canDeleteStructures, async () => { await service.deleteSalaryStructure(id); return id }),
    createPayrun: input => mutate(getPayrollPermissions().canCreatePayrun, async () => (await service.createPayrun(input)).id),
    updatePayrun: (id, input) => mutate(getPayrollPermissions().canUpdatePayrun, async () => (await service.updatePayrun(id, input)).id),
    computePayrun: id => mutate(getPayrollPermissions().canCompute, async () => (await service.computePayrun(id)).id),
    validatePayrun: id => mutate(getPayrollPermissions().canUpdatePayrun, async () => (await service.validatePayrun(id)).id),
    markPaid: id => mutate(getPayrollPermissions().canUpdatePayrun, async () => (await service.markPayrunPaid(id)).id),
    removePayrun: id => mutate(getPayrollPermissions().canDeletePayrun, async () => { await service.deletePayrun(id); return id }),
    removePayslip: id => mutate(getPayrollPermissions().canDeletePayslip, () => service.deletePayslip(id)),
    setBankDetails: (id, account) => mutate(getPayrollPermissions().canUpdateBank, async () => { await service.setBankAccount(id, account); return id }),
  }
})
