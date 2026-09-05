import { create } from '@/features/nexacrm/adapters/native-store'
import * as service from './service'
import type {
  BankDetailsInput,
  PayrollData,
  Payrun,
  PayrunDetail,
  PayrunInput,
  Payslip,
  Result,
  SalaryRule,
  SalaryRuleInput,
  SalaryStructure,
  SalaryStructureInput,
  SendPayslipsResult
} from './types'

type PayrollStore = PayrollData & {
  hasHydrated: boolean
  isLoading: boolean
  error: string | null
  load: () => Promise<void>
  saveRule: (input: SalaryRuleInput, id?: string) => Promise<Result>
  removeRule: (id: string) => Promise<Result>
  saveStructure: (input: SalaryStructureInput, id?: string) => Promise<Result>
  removeStructure: (id: string) => Promise<Result>
  createPayrun: (input: PayrunInput) => Promise<Result>
  computePayrun: (id: string) => Promise<Result>
  validatePayrun: (id: string) => Promise<Result>
  markPaid: (id: string) => Promise<Result>
  removePayrun: (id: string) => Promise<Result>
  removePayslip: (id: string) => Promise<Result>
  sendPayslips: (id: string, payslipIds: string[]) => Promise<SendPayslipsResult>
  saveBankDetails: (employeeId: string, input: BankDetailsInput) => Promise<Result>
}

type Stored = { id: string; updatedAt: string }
const LOAD_ERROR = 'Unable to load payroll. Please try again.'
const ACTION_ERROR = 'Something went wrong. Please try again.'

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.trim() ? error.message : fallback
}
function latest<T extends Stored>(record: T, cached?: T): T {
  if (cached && Date.parse(cached.updatedAt) > Date.parse(record.updatedAt)) return cached
  return record
}
// A snapshot that started before a write must not roll that write back.
function reconcile<T extends Stored>(incoming: T[], current: T[]): T[] {
  const cached = new Map(current.map(item => [item.id, item]))
  return incoming.map(item => latest(item, cached.get(item.id)))
}
function merge<T extends Stored>(list: T[], record: T): T[] {
  return list.some(item => item.id === record.id)
    ? list.map(item => (item.id === record.id ? record : item))
    : [record, ...list]
}

let loadVersion = 0
let loadController: AbortController | undefined

export const usePayrollStore = create<PayrollStore>()((set, get) => {
  async function refresh() {
    await Promise.allSettled([get().load()])
  }
  async function mutate(action: () => Promise<string>, reload = false): Promise<Result> {
    try {
      const id = await action()
      if (reload) await refresh()
      return { ok: true, id }
    } catch (error) {
      return { ok: false, error: message(error, ACTION_ERROR) }
    }
  }
  function rememberRule(record: SalaryRule): string {
    set(state => ({ rules: merge(state.rules, record) }))
    return record.id
  }
  function rememberStructure(record: SalaryStructure): string {
    set(state => ({ structures: merge(state.structures, record) }))
    return record.id
  }
  function rememberPayrun(record: Payrun): string {
    set(state => ({ payruns: merge(state.payruns, record) }))
    return record.id
  }
  function rememberDetail(detail: PayrunDetail): string {
    set(state => ({
      payruns: merge(state.payruns, detail.payrun),
      payslips: [
        ...detail.payslips,
        ...state.payslips.filter(slip => slip.payrunId !== detail.payrun.id)
      ]
    }))
    return detail.payrun.id
  }

  return {
    rules: [],
    structures: [],
    payruns: [],
    payslips: [],
    hasHydrated: false,
    isLoading: false,
    error: null,

    async load() {
      const version = ++loadVersion
      loadController?.abort()
      loadController = new AbortController()
      const { signal } = loadController
      set({ isLoading: true, error: null })
      try {
        const data = await service.loadPayroll(signal)
        if (version !== loadVersion) return
        set({
          rules: reconcile(data.rules, get().rules),
          structures: reconcile(data.structures, get().structures),
          payruns: reconcile(data.payruns, get().payruns),
          payslips: reconcile(data.payslips, get().payslips),
          hasHydrated: true,
          isLoading: false,
          error: null
        })
      } catch (error) {
        if (version !== loadVersion || signal.aborted) return
        set({ error: message(error, LOAD_ERROR), hasHydrated: true, isLoading: false })
      }
    },

    saveRule: (input, id) =>
      mutate(async () => rememberRule(id ? await service.updateRule(id, input) : await service.createRule(input)), true),

    removeRule: id =>
      mutate(async () => {
        await service.deleteRule(id)
        set(state => ({ rules: state.rules.filter(item => item.id !== id) }))
        return id
      }, true),

    // Sequence overrides touch other rules, so the snapshot is refreshed after saving.
    saveStructure: (input, id) =>
      mutate(
        async () =>
          rememberStructure(id ? await service.updateStructure(id, input) : await service.createStructure(input)),
        true
      ),

    removeStructure: id =>
      mutate(async () => {
        await service.deleteStructure(id)
        set(state => ({ structures: state.structures.filter(item => item.id !== id) }))
        return id
      }, true),

    createPayrun: input => mutate(async () => rememberPayrun(await service.createPayrun(input)), true),
    computePayrun: id => mutate(async () => rememberDetail(await service.computePayrun(id))),
    validatePayrun: id =>
      mutate(async () => {
        try {
          return rememberDetail(await service.validatePayrun(id))
        } catch (error) {
          // A refused validation still refreshed the computation server-side.
          await service.getPayrun(id).then(rememberDetail).catch(() => {})
          throw error
        }
      }),
    markPaid: id => mutate(async () => rememberDetail(await service.markPayrunPaid(id))),

    removePayrun: id =>
      mutate(async () => {
        await service.deletePayrun(id)
        set(state => ({
          payruns: state.payruns.filter(item => item.id !== id),
          payslips: state.payslips.filter(item => item.payrunId !== id)
        }))
        return id
      }, true),

    removePayslip: id =>
      mutate(async () => {
        const slip = get().payslips.find(item => item.id === id)
        await service.deletePayslip(id)
        set(state => ({ payslips: state.payslips.filter(item => item.id !== id) }))
        return slip?.payrunId ?? id
      }, true),

    async sendPayslips(id, payslipIds) {
      const result = await service.sendPayslips(id, payslipIds)
      await refresh()
      return result
    },

    saveBankDetails: (employeeId, input) =>
      mutate(async () => (await service.saveBankDetails(employeeId, input)).employeeId)
  }
})

export const selectPayslip = (id: string) => (state: PayrollStore): Payslip | undefined =>
  state.payslips.find(slip => slip.id === id)
