import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import ts from 'typescript'

const root = process.cwd()
const requirePackage = createRequire(import.meta.url)
const cache = new Map()
const mocks = {}
function load(relative) {
  let file = path.resolve(root, relative)
  if (!fs.existsSync(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx'
  if (cache.has(file)) return cache.get(file).exports
  const loadedModule = { exports: {} }
  cache.set(file, loadedModule)
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const requireLocal = spec => mocks[spec] ?? (spec.startsWith('@/') ? load(spec.slice(2)) : spec.startsWith('.') ? load(path.resolve(path.dirname(file), spec)) : requirePackage(spec))
  new Function('require', 'module', 'exports', output)(requireLocal, loadedModule, loadedModule.exports)
  return loadedModule.exports
}
const { payrollAccess } = load('features/auth/permissions.ts')
const service = load('features/payroll/service.ts')
const offsets = []
assert.deepEqual(await service.collectPayrollPages(async offset => {
  offsets.push(offset)
  const items = [1, 2, 3, 4, 5].slice(offset, offset + 2)
  return { items, pagination: { total: 5, limit: 2, offset, hasMore: offset + items.length < 5 } }
}), [1, 2, 3, 4, 5])
assert.deepEqual(offsets, [0, 2, 4], 'search must include records beyond the first API page')
await assert.rejects(service.collectPayrollPages(async () => ({ items: [], pagination: { total: 2, limit: 2, offset: 0, hasMore: true } })), /did not advance/)

const originalFetch = globalThis.fetch
const deliveryBodies = []
const deliveryIds = Array.from({ length: 505 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`)
const deliveryRunId = '10000000-0000-4000-8000-000000000001'
try {
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body)
    deliveryBodies.push(body)
    return new Response(JSON.stringify({ success: true, data: {
      payrunId: deliveryRunId, queued: [],
      skipped: body.payslipIds.map(id => ({ payslipId: id, employeeName: 'Test recipient', reason: 'Test-only response' })),
    } }), { status: 202 })
  }
  const dispatch = await service.sendPayrunPayslips(deliveryRunId, {
    payslipIds: deliveryIds, recipients: [{ payslipId: deliveryIds[504], email: 'test@example.test' }],
  })
  assert.deepEqual(deliveryBodies.map(body => body.payslipIds.length), [500, 5])
  assert.equal(deliveryBodies[0].recipients, undefined)
  assert.equal(deliveryBodies[1].recipients[0].payslipId, deliveryIds[504])
  assert.equal(dispatch.skipped.length, 505)
  await assert.rejects(service.sendPayrunPayslips(deliveryRunId, { payslipIds: [] }), /Select at least one/)
  await assert.rejects(service.sendPayrunPayslips(deliveryRunId, { payslipIds: [...deliveryIds, 'invalid'] }), /valid payroll record/)
  assert.equal(deliveryBodies.length, 2, 'invalid selections must fail before any request is sent')
} finally { globalThis.fetch = originalFetch }

let actor = { id: 'admin', role: 'admin' }
let rules = [{ id: 'rule-1', name: 'Basic' }]
let structures = [{ id: 'structure-1', name: 'Monthly' }]
let runs = Array.from({ length: 5 }, (_, index) => ({ id: `run-${index}`, name: `Run ${index}` }))
let slips = Array.from({ length: 7 }, (_, index) => ({ id: `slip-${index}`, employeeId: `employee-${index}`, bankAccount: 'account' }))
let writes = 0
let failWrite = false
let blockRules
let lastInput
const calls = []
const page = (items, offset) => ({ pagination: { total: items.length, limit: 2, offset, hasMore: offset + 2 < items.length } })
const write = async (id, input) => { writes++; lastInput = input; if (failWrite) throw new Error('Backend refused this action'); return { id } }
mocks['./permissions'] = { getPayrollPermissions: () => payrollAccess(actor) }
mocks['./service'] = {
  collectPayrollPages: service.collectPayrollPages,
  listSalaryRules: async () => { calls.push('rules'); if (blockRules) return blockRules; return rules },
  listSalaryStructures: async () => { calls.push('structures'); return structures },
  listPayruns: async ({ offset }) => { calls.push('runs:' + offset); return { ...page(runs, offset), payruns: runs.slice(offset, offset + 2) } },
  listPayslips: async ({ offset }) => { calls.push('slips:' + offset); return { ...page(slips, offset), payslips: slips.slice(offset, offset + 2) } },
  createSalaryRule: input => write('created-rule', input),
  updateSalaryRule: write,
  deleteSalaryRule: write,
  createSalaryStructure: (input, sequences) => write('created-structure', { ...input, sequences }),
  updateSalaryStructure: (id, input, sequences) => write(id, { ...input, sequences }),
  deleteSalaryStructure: write,
  createPayrun: input => write('created-run', input),
  updatePayrun: write,
  computePayrun: write,
  validatePayrun: write,
  markPayrunPaid: write,
  deletePayrun: write,
  deletePayslip: async id => (await write(id)).id,
  setBankAccount: write,
}
const store = load('features/payroll/store.ts').usePayrollStore
await store.getState().load(actor)
assert.equal(store.getState().payruns.length, 5)
assert.equal(store.getState().payslips.length, 7)
assert.equal(store.getState().isLoading, false)
assert.equal(store.getState().bankDetails['employee-6'], 'account')
assert.ok(calls.includes('runs:4') && calls.includes('slips:6'))
const callCount = calls.length
await store.getState().load(actor)
assert.equal(calls.length, callCount, 'repeat mounting must not reload an already-hydrated account')

const rule = { id: 'existing-rule', name: 'Basic', code: 'BASIC', category: 'basic', sequence: 10, method: 'fixed', amount: 10, percentage: 0, base: '', formula: '', active: true, quantity: 2 }
assert.equal((await store.getState().saveRule(rule, rule.id)).ok, true)
assert.equal(lastInput.quantity, 2)
assert.equal('id' in lastInput, false, 'read-only response fields must not leak into PATCH bodies')
assert.equal((await store.getState().saveStructure({ id: 's', name: 'Monthly', description: '', active: true, ruleIds: ['r'], employeeCount: 20 }, 's', [{ id: 'r', sequence: 10 }])).ok, true)
assert.equal('employeeCount' in lastInput, false)
assert.deepEqual(lastInput.sequences, [{ id: 'r', sequence: 10 }])

failWrite = true
const before = store.getState().payruns
assert.deepEqual(await store.getState().removePayrun('run-0'), { ok: false, error: 'Backend refused this action' })
assert.deepEqual(store.getState().payruns, before, 'failed writes must not remove local rows')
failWrite = false
actor = { id: 'payroll-user', role: 'hr_payroll_user' }
await store.getState().load(actor)
const beforeDenied = writes
assert.equal((await store.getState().removePayrun('run-0')).ok, false)
assert.equal(writes, beforeDenied)
assert.equal((await store.getState().createPayrun({ name: 'Test' })).ok, true)

let resolveOld
blockRules = new Promise(resolve => { resolveOld = resolve })
const pending = store.getState().load({ id: 'old-account', role: 'admin' }, true)
actor = { id: 'employee', role: 'employee' }
await store.getState().load(actor, true)
assert.equal(store.getState().payruns.length, 0)
assert.equal(store.getState().payslips.length, 0)
resolveOld([{ id: 'private-rule' }]); await pending
assert.equal(store.getState().rules.length, 0, 'late responses from another account must not repopulate records')
blockRules = undefined
actor = { id: 'revoked-admin', role: 'admin', permissions: [] }
const beforeRevoked = calls.length
await store.getState().load(actor, true)
assert.equal(calls.length, beforeRevoked, 'explicitly revoked grants must not fetch payroll')

console.log('PASS: payroll pagination, complete data loading, API-only writes, payload compatibility, failure handling, account isolation and role restrictions.')
