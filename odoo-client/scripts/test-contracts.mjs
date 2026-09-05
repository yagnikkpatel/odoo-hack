import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const cache = new Map()
const read = relative => fs.readFileSync(path.resolve(root, relative), 'utf8')
function load(relative) {
  const file = path.resolve(root, relative)
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const localRequire = spec => spec === '@/features/hr/data-availability' ? load('scripts/fixtures/data-connection.ts') : spec.startsWith('@/') ? load(spec.slice(2) + '.ts')
    : spec.startsWith('.') ? load(path.resolve(path.dirname(file), spec + '.ts')) : requirePackage(spec)
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const { validateContract, contractStatus, contractForPeriod, datesOverlap, formatWage } = load('features/contracts/types.ts')
const base = { name: 'Agreement', employeeId: 'emp_1', startDate: '2026-01-01', endDate: '2026-06-30', department: 'Engineering', jobPosition: 'Engineer', wage: 85000, currency: 'INR', wagePeriod: 'month', salaryStructure: 'Regular salary', state: 'active' }
const existing = { ...base, id: 'ctr_1', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' }
const ids = ['emp_1', 'emp_2']
assert.equal(validateContract(base, [], ids), null)
for (const change of [{ name: ' ' }, { employeeId: 'missing' }, { startDate: '2026-02-30' }, { startDate: '' }, { endDate: '2025-12-31' }, { endDate: 'invalid' }, { wage: -1 }, { wage: NaN }, { wage: Infinity }, { currency: 'INVALID' }, { wagePeriod: 'invalid' }, { department: ' ' }, { jobPosition: '' }, { salaryStructure: '' }, { state: 'unknown' }]) {
  assert.ok(validateContract({ ...base, ...change }, [], ids), JSON.stringify(change))
}
assert.match(validateContract(base, [existing], ids), /overlap/)
assert.equal(validateContract(base, [existing], ids, existing.id), null, 'editing the same contract is not a conflict')
assert.equal(validateContract({ ...base, employeeId: 'emp_2' }, [existing], ids), null)
assert.equal(validateContract({ ...base, state: 'draft' }, [existing], ids), null)
assert.equal(validateContract({ ...base, state: 'cancelled' }, [existing], ids), null)
assert.match(validateContract({ ...base, startDate: '2026-06-30', endDate: undefined }, [existing], ids), /overlap/, 'dates are inclusive')
assert.equal(validateContract({ ...base, startDate: '2026-07-01', endDate: undefined }, [existing], ids), null)
assert.equal(datesOverlap({ startDate: '2026-01-01' }, { startDate: '2040-01-01' }), true)
assert.equal(contractStatus(base, '2025-12-31'), 'scheduled')
assert.equal(contractStatus(base, '2026-01-01'), 'active')
assert.equal(contractStatus(base, '2026-06-30'), 'active')
assert.equal(contractStatus(base, '2026-07-01'), 'expired')
assert.equal(contractStatus({ ...base, state: 'draft' }, '2026-07-01'), 'draft')
assert.equal(contractStatus({ ...base, state: 'cancelled' }, '2026-01-10'), 'cancelled')
assert.equal(contractStatus({ ...base, endDate: undefined }, '2040-01-01'), 'active')
const renewal = { ...existing, id: 'ctr_2', startDate: '2026-07-01', endDate: undefined }
assert.equal(contractForPeriod([existing, renewal], 'emp_1', '2026-05-01', '2026-05-31'), existing, 'historical payroll must select its historical contract')
assert.equal(contractForPeriod([existing, renewal], 'emp_1', '2026-08-01', '2026-08-31'), renewal)
assert.equal(contractForPeriod([existing], 'emp_2', '2026-01-01', '2026-01-31'), undefined)
assert.equal(contractForPeriod([{ ...existing, state: 'draft' }], 'emp_1', '2026-01-01', '2026-01-31'), undefined)
assert.throws(() => contractForPeriod([existing, renewal], 'emp_1', '2026-06-01', '2026-07-31'), /multiple contracts/)
assert.throws(() => contractForPeriod([], 'emp_1', 'invalid', '2026-01-31'), /valid payroll period/)
assert.match(formatWage(base), /85,000/)
assert.match(formatWage(base), /month/)

const { useEmployeesStore } = load('features/employees/store.ts')
const { useContractsStore } = load('features/contracts/store.ts')
const { useCurrentActorStore } = load('features/nexacrm/store/use-current-actor-store.ts')
const employees = ids.map((id, index) => ({ id, firstName: 'Employee', lastName: String(index), email: 'demo@example.com', createdAt: existing.createdAt, updatedAt: existing.updatedAt }))
useEmployeesStore.getState().initialize(employees)
const employeeState = useEmployeesStore.getState()
useCurrentActorStore.getState().setActorId('usr_test')
const state = () => useContractsStore.getState()
state().initialize([existing])
state().initialize([])
assert.equal(state().contracts.length, 1, 'navigation must not reset the preview')
const before = state()
assert.equal(state().save(base).ok, false)
assert.equal(state(), before, 'validation failure must not mutate state')
assert.equal(state().save(base, 'missing').ok, false)
const created = state().save({ ...base, employeeId: 'emp_2', name: '  New agreement  ', employeeName: 'Derived name', status: 'derived status' })
assert.equal(created.ok, true)
assert.equal(state().contracts.length, 2)
const record = state().contracts.find(item => item.id === created.id)
assert.equal(record.name, 'New agreement')
assert.equal(record.createdById, 'usr_test')
assert.equal(Object.hasOwn(record, 'employeeName'), false, 'derived table fields must not leak into persisted terms')
assert.equal(Object.hasOwn(record, 'status'), false)
assert.equal(state().save({ ...record, wage: 90000 }, created.id).ok, true)
assert.equal(state().contracts.find(item => item.id === created.id).createdAt, record.createdAt)
assert.equal(state().contracts.find(item => item.id === created.id).wage, 90000)
state().remove(created.id)
assert.equal(state().contracts.length, 1)
assert.equal(state().contracts[0], existing)
assert.equal(state().save(base, existing.id).ok, true)
assert.equal(state().contracts[0].createdById, undefined, 'editing must preserve the original unknown creator')
assert.equal(useEmployeesStore.getState(), employeeState, 'contract terms must not silently overwrite employee master data')

const { contractCsvRows } = load('features/contracts/csv.ts')
const exported = contractCsvRows([{ ...existing, employeeName: '=formula', name: ' +formula', status: 'active' }])[0]
assert.equal(exported.Employee, "'=formula")
assert.equal(exported.Contract, "' +formula")
assert.equal(exported.Wage, 85000)
assert.equal(exported.Status, 'Active')

const view = read('features/contracts/index.tsx')
for (const component of ['RecordViewBar', 'DataTable', 'DataTablePagination', 'ContractPanel', 'ContractEditor']) assert.ok(view.includes(component))
assert.ok(view.includes('[&_[data-slot=table-container]]:border-b'))
assert.doesNotMatch(view, /Kpi|StatsCard|Chart/)
const panel = read('features/contracts/contract-panel.tsx')
assert.match(panel, /PreviewSheet/)
assert.match(panel, /Open full details/)
assert.match(panel, /ContractHistory/)
assert.match(read('features/contracts/components/contract-editor.tsx'), /onSubmit=\{submit\}/)
assert.match(read('features/employees/components/employee-fields.tsx'), /EmployeeContractsLink/)
assert.match(read('features/contracts/components/employee-contracts-link.tsx'), /\/contracts\?employee=/)
assert.match(read('app/(app)/contracts/page.tsx'), /@\/features\/contracts/)
assert.match(read('app/(app)/contracts/[id]/page.tsx'), /contract-detail/)
console.log('PASS: contract fields, dates/status, inclusive overlap guards, historical period lookup, isolated CRUD, CSV, preview/history and employee links.')
