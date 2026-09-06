import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const modules = new Map()
function load(relative) {
  let file = path.resolve(root, relative)
  if (!existsSync(file)) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const loaded = { exports: {} }
  modules.set(file, loaded)
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = name => name.startsWith('@/') ? load(name.slice(2))
    : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : requirePackage(name)
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const { mapDashboard, getDashboard } = load('features/dashboard/service.ts')
if (process.argv[2]) {
  const aggregate = JSON.parse(readFileSync(process.argv[2], 'utf8'))
  assert.deepEqual(mapDashboard(aggregate), aggregate, 'actual API aggregate preserves every returned metric')
  console.log('PASS: Live database aggregate accepted without changing metrics.')
}
// Anonymous aggregate contract fixture. No employees or private bank/payroll records.
const fixture = {
  period: { startDate: '2026-08-01', endDate: '2026-08-31', previousStartDate: '2026-07-01', previousEndDate: '2026-07-31' },
  currency: 'INR',
  filters: { departments: ['Engineering'], jobPositions: ['Engineer'], currencies: ['INR'] },
  totals: { payslips: 229, netPaid: 0, grossPaid: 0, deductionsPaid: 0, employeesPaid: 0, statusCounts: { draft: 0, computed: 229, validated: 0, paid: 0 } },
  previous: { netPaid: 0, payslips: 226 }, netPaidChange: null, averageNet: 0, headcount: 248,
  departments: [{ department: 'Engineering', headcount: 51, payslips: 0, net: 0, gross: 0 }],
  trends: [{ month: '2026-06', net: 18856789.38, payslips: 197 }, { month: '2026-08', net: 0, payslips: 0 }],
  attendance: { records: 5164, employees: 248, present: 4686, absent: 318, incomplete: 160, missingCheckOuts: 160, manualEdits: 0, workedHours: 40297.02, overtimeHours: 4079.41, coverage: 91 },
  timeOff: { approvedDays: 8, approvedHours: 2, unpaidDays: 0, unpaidHours: 0, pendingRequests: 1, remainingDays: 12, remainingHours: 0,
    types: [
      { typeId: 'leave-days', name: 'Paid Time Off', unit: 'days', paid: true, approved: 8, pendingRequests: 1, remaining: 12 },
      { typeId: 'leave-hours', name: 'Comp Off', unit: 'hours', paid: true, approved: 2, pendingRequests: 0, remaining: null },
    ] },
  payrunStatusCounts: { draft: 0, computed: 5, validated: 0, paid: 0 },
  alerts: [{ code: 'unvalidated_payrun', message: 'Payruns awaiting validation', count: 5, blocking: false }],
  warnings: [{ code: 'rules', message: 'Salary rules need review', blocking: true, payrunId: 'aggregate-run', payrunName: 'August payroll' }],
}
assert.deepEqual(mapDashboard(fixture), fixture)
assert.equal(mapDashboard(fixture).totals.netPaid, 0, 'computed payroll must not become paid salary')
assert.equal(mapDashboard(fixture).timeOff.approvedHours, 2, 'hours stay separate from approved days')
const noCoverage = structuredClone(fixture)
noCoverage.attendance.coverage = null
assert.equal(mapDashboard(noCoverage).attendance.coverage, null, 'unknown coverage must not become zero')

let rejected = 0
function rejectsChange(label, change) {
  const value = structuredClone(fixture)
  change(value)
  assert.throws(() => mapDashboard(value), error => error.name === 'ApiError' && error.status === 502, label)
  rejected++
}
for (const field of Object.keys(fixture)) rejectsChange(`missing ${field}`, value => { delete value[field] })
for (const [section, fields] of Object.entries({
  period: ['startDate', 'endDate', 'previousStartDate', 'previousEndDate'],
  totals: ['netPaid', 'employeesPaid', 'statusCounts'],
  attendance: ['records', 'present', 'workedHours', 'coverage'],
  timeOff: ['approvedDays', 'approvedHours', 'pendingRequests', 'types'],
})) for (const field of fields) rejectsChange(`missing ${section}.${field}`, value => { delete value[section][field] })
for (const [label, change] of [
  ['omitted status', value => { delete value.totals.statusCounts.paid }],
  ['omitted payrun status', value => { delete value.payrunStatusCounts.draft }],
  ['string number', value => { value.totals.netPaid = '0' }],
  ['nonfinite money', value => { value.totals.netPaid = Infinity }],
  ['negative count', value => { value.headcount = -1 }],
  ['fractional count', value => { value.attendance.records = 2.5 }],
  ['invalid date', value => { value.period.startDate = '2026-02-30' }],
  ['unrenderable currency', value => { value.currency = 'rupees' }],
  ['invalid currency filter', value => { value.filters.currencies = ['₹'] }],
  ['invalid trend month', value => { value.trends[0].month = '2026-13' }],
  ['missing department data', value => { delete value.departments[0].net }],
  ['invalid leave unit', value => { value.timeOff.types[0].unit = 'weeks' }],
  ['missing nullable balance', value => { delete value.timeOff.types[0].remaining }],
  ['invalid leave flag', value => { value.timeOff.types[0].paid = 'true' }],
  ['invalid alert count', value => { value.alerts[0].count = -1 }],
  ['missing warning severity', value => { delete value.warnings[0].blocking }],
  ['malformed filters', value => { value.filters.departments = {} }],
]) rejectsChange(label, change)

const originalFetch = globalThis.fetch
const calls = []
let status = 200
let payload = { success: true, data: fixture }
globalThis.fetch = async (url, options) => {
  calls.push({ url: new URL(url, 'https://example.test'), options })
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}
try {
  const query = { startDate: '2026-08-01', endDate: '2026-08-31', currency: 'INR', department: ' Data & Analytics ', jobPosition: ' Analyst ' }
  const controller = new AbortController()
  assert.deepEqual(await getDashboard(query, controller.signal), fixture)
  const { url, options } = calls.at(-1)
  assert.equal(url.pathname, '/api/payroll/dashboard')
  assert.deepEqual(Object.fromEntries(url.searchParams), { startDate: query.startDate, endDate: query.endDate, currency: 'INR', department: 'Data & Analytics', jobPosition: 'Analyst' })
  assert.equal(options.signal, controller.signal)
  assert.equal(options.credentials, 'same-origin')
  assert.equal(options.cache, 'no-store')
  await getDashboard({ ...query, department: '  ', jobPosition: undefined })
  assert.equal(calls.at(-1).url.searchParams.has('department'), false)
  assert.equal(calls.at(-1).url.searchParams.has('jobPosition'), false)
  for (const code of [401, 403, 503]) {
    status = code
    payload = { success: false, message: 'Private upstream diagnostic' }
    await assert.rejects(getDashboard(query), error => error.status === code && !error.message.includes('Private'))
  }
  status = 200
  for (const body of [{ success: false, data: fixture }, { success: true, data: {} }, null]) {
    payload = body
    await assert.rejects(getDashboard(query), error => error.status === 502)
  }
} finally {
  globalThis.fetch = originalFetch
}
console.log(`PASS: Dashboard aggregate mapping, ${rejected} malformed payloads rejected, separate leave units, paid-only values, query filters, cancellation, and API failures.`)
