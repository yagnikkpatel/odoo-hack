import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const cache = new Map()
function load(relative) {
  let file = path.resolve(root, relative)
  if (!fs.existsSync(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx'
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  const localRequire = spec =>
    spec === '@/features/hr/data-availability' ? load('scripts/fixtures/data-connection.ts') : spec.startsWith('@/')
      ? load(spec.slice(2))
      : spec.startsWith('.')
        ? load(path.resolve(path.dirname(file), spec))
        : requirePackage(spec)
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}
const {
  validDate,
  dateRange,
  calculateRequest,
  employeeBalance,
  allocationBalance,
  planConsumption,
  formatAmount,
  requestsOverlap
} = load('features/time-off/logic.ts')
const { useTimeOffStore } = load('features/time-off/store.ts')
const { useEmployeesStore } = load('features/employees/store.ts')
const { useSchedulesStore } = load('features/working-schedules/store.ts')
const { useCurrentActorStore } = load('features/nexacrm/store/use-current-actor-store.ts')
const state = () => useTimeOffStore.getState()
const context = { employeeIds: ['emp_1', 'emp_2'], schedules: [], assignments: {} }
const type = {
  name: 'Annual leave',
  code: 'ANNUAL',
  unit: 'days',
  requiresAllocation: true,
  approval: 'manager',
  payroll: 'paid',
  active: true,
  description: ''
}
const allocation = {
  employeeId: 'emp_1',
  typeId: 'type',
  amount: 3,
  validFrom: '2026-01-01',
  validTo: '2026-12-31',
  note: ''
}
const input = {
  employeeId: 'emp_1',
  typeId: 'type',
  startDate: '2026-01-05',
  endDate: '2026-01-05',
  startTime: '',
  endTime: '',
  reason: 'Family commitment'
}
const recordType = { ...type, id: 'type', createdAt: '2026-01-01', updatedAt: '2026-01-01' }
const empty = { types: [recordType], allocations: [], requests: [] }
useEmployeesStore
  .getState()
  .initialize(
    context.employeeIds.map(id => ({
      id,
      firstName: id,
      lastName: '',
      email: 'test@example.com',
      createdAt: '',
      updatedAt: ''
    }))
  )
useSchedulesStore.getState().initialize([], {})
useCurrentActorStore.getState().setActorId('actor_test')
const unrelated = { employees: useEmployeesStore.getState(), schedules: useSchedulesStore.getState() }
function reset(data = empty) {
  useTimeOffStore.setState({ ...structuredClone(data), hasHydrated: true })
}
function ok(result) {
  assert.equal(result.ok, true, JSON.stringify(result))
  return result.id
}
function rejected(operation, pattern) {
  const before = state()
  const serialized = JSON.stringify(before)
  const result = operation()
  assert.equal(result.ok, false, JSON.stringify(result))
  if (pattern) assert.match(result.error, pattern)
  assert.equal(state(), before, 'failed writes preserve state identity')
  assert.equal(JSON.stringify(before), serialized, 'failed writes never mutate nested records')
}
function grant(overrides = {}) {
  const id = ok(state().saveAllocation({ ...allocation, ...overrides }))
  ok(state().approveAllocation(id))
  return id
}
function request(overrides = {}) {
  return ok(state().saveRequest({ ...input, ...overrides }))
}

assert.equal(validDate('2024-02-29'), true)
for (const value of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', 'junk', '1899-01-01', '2101-01-01'])
  assert.equal(validDate(value), false)
assert.equal(dateRange('2026-12-31', '2027-01-01').length, 2)
assert.equal(dateRange('2024-01-01', '2024-12-31').length, 366)
assert.equal(dateRange('2024-01-01', '2025-01-01').length, 0)
assert.equal(
  calculateRequest({ ...input, startDate: '2026-01-02', endDate: '2026-01-05' }, empty, context).duration,
  2,
  'weekends excluded'
)
assert.equal(calculateRequest({ ...input, startDate: '2026-01-03', endDate: '2026-01-04' }, empty, context).ok, false)
for (const overrides of [
  { startDate: '2026-02-30' },
  { endDate: '2025-12-31' },
  { employeeId: 'unknown' },
  { typeId: 'unknown' },
  { endDate: '2027-01-06' }
])
  assert.equal(calculateRequest({ ...input, ...overrides }, empty, context).ok, false)
const saturdaySchedule = { id: 'sat', slots: [{ day: 5, start: '10:00', end: '15:00', breakMinutes: 60 }] }
const saturdayContext = { ...context, schedules: [saturdaySchedule], assignments: { emp_1: 'sat' } }
assert.equal(calculateRequest(input, empty, saturdayContext).ok, false)
assert.equal(
  calculateRequest({ ...input, startDate: '2026-01-03', endDate: '2026-01-03' }, empty, saturdayContext).duration,
  1
)
assert.equal(calculateRequest(input, empty, { ...context, assignments: { emp_1: 'missing' } }).ok, false)
const hoursData = { ...empty, types: [{ ...recordType, unit: 'hours' }] }
const hourly = { ...input, startTime: '09:00', endTime: '10:30' }
assert.equal(calculateRequest(hourly, hoursData, context).duration, 1.5)
for (const overrides of [
  { endTime: '09:00' },
  { endTime: '08:30' },
  { startTime: '25:00' },
  { startTime: '08:00' },
  { endTime: '18:00' },
  { endDate: '2026-01-06' }
])
  assert.equal(calculateRequest({ ...hourly, ...overrides }, hoursData, context).ok, false)
assert.equal(formatAmount(1, 'days'), '1 day')
assert.equal(formatAmount(1.5, 'hours'), '1.5 hours')

reset()
for (const overrides of [
  { amount: -1 },
  { amount: 0 },
  { amount: NaN },
  { amount: Infinity },
  { employeeId: 'missing' },
  { typeId: 'missing' },
  { validTo: '2025-12-31' },
  { validFrom: '2026-02-30' }
])
  rejected(() => state().saveAllocation({ ...allocation, ...overrides }))
rejected(() => state().saveType({ ...type, unit: 'minutes' }))
rejected(() => state().saveType({ ...type, code: 'bad code' }))
rejected(() => state().saveType({ ...type, name: '' }))
rejected(() => state().saveType({ ...type, name: 'Other', code: 'annual' }), /already/)
const pendingGrant = ok(state().saveAllocation(allocation))
assert.deepEqual(allocationBalance(state(), pendingGrant), { allocated: 0, taken: 0, remaining: 0, pending: 3 })
rejected(() => state().saveRequest(input), /Insufficient/)
rejected(() => state().refuseAllocation(pendingGrant, ' '), /reason/)
ok(state().refuseAllocation(pendingGrant, 'Not yet'))
rejected(() => state().approveAllocation(pendingGrant), /pending/)
ok(state().saveAllocation(allocation, pendingGrant))
ok(state().approveAllocation(pendingGrant))
rejected(() => state().approveAllocation(pendingGrant), /pending/)
rejected(() => state().refuseAllocation(pendingGrant, 'No'), /pending/)
rejected(() => state().saveAllocation(allocation, pendingGrant), /Approved/)
rejected(() => state().removeAllocation(pendingGrant), /historical/)
assert.equal(state().allocations[0].history.at(-1).actorId, 'actor_test')
for (const change of [{ unit: 'hours' }, { requiresAllocation: false }, { approval: 'none' }, { payroll: 'unpaid' }])
  rejected(() => state().saveType({ ...type, ...change }, 'type'), /already used/)
ok(state().saveType({ ...type, name: 'Renamed leave' }, 'type'))
rejected(() => state().removeType('type'), /referenced/)
const pending = request()
assert.equal(employeeBalance(state(), 'emp_1', 'type', '2026-01-05').remaining, 3)
assert.equal(employeeBalance(state(), 'emp_1', 'type', '2026-01-05').pending, 1)
assert.equal(state().requests[0].consumptions.length, 0)
rejected(() => state().saveRequest(input), /already/)
rejected(() => state().refuseRequest(pending, ''), /reason/)
ok(state().approveRequest(pending))
assert.deepEqual(employeeBalance(state(), 'emp_1', 'type', '2026-01-05'), {
  allocated: 3,
  taken: 1,
  remaining: 2,
  pending: 0
})
assert.equal(state().requests[0].history.at(-1).actorId, 'actor_test')
rejected(() => state().approveRequest(pending), /pending/)
rejected(() => state().saveRequest(input, pending), /Only pending/)
rejected(() => state().removeRequest(pending), /Cancel approved/)
rejected(() => state().removeAllocation(pendingGrant), /history/)
ok(state().cancelRequest(pending, 'Plans changed'))
assert.deepEqual(employeeBalance(state(), 'emp_1', 'type', '2026-01-05'), {
  allocated: 3,
  taken: 0,
  remaining: 3,
  pending: 0
})
assert.equal(state().requests[0].consumptions.length, 1, 'cancelled audit references retained')
rejected(() => state().cancelRequest(pending, 'Again'))
rejected(() => state().removeAllocation(pendingGrant), /history/)
const refused = request()
ok(state().refuseRequest(refused, 'Coverage unavailable'))
assert.equal(employeeBalance(state(), 'emp_1', 'type', '2026-01-05').remaining, 3)
ok(state().saveRequest({ ...input, endDate: '2026-01-06' }, refused))
assert.equal(state().requests.find(item => item.id === refused).status, 'pending')
ok(state().removeRequest(refused))

reset()
const later = grant({ amount: 3, validTo: '2026-12-31' })
const earlier = grant({ amount: 1, validTo: '2026-01-05' })
const twoDays = request({ endDate: '2026-01-06' })
ok(state().approveRequest(twoDays))
assert.deepEqual(
  state().requests[0].consumptions.map(item => [item.allocationId, item.date, item.amount]),
  [
    [earlier, '2026-01-05', 1],
    [later, '2026-01-06', 1]
  ],
  'earliest expiry first, valid per charge date'
)
assert.equal(employeeBalance(state(), 'emp_1', 'type', '2026-01-06').allocated, 3)
assert.equal(
  employeeBalance(state(), 'emp_1', 'type', '2026-01-06').taken,
  1,
  'expired grant and its taken leave excluded together'
)
assert.equal(allocationBalance(state(), earlier).taken, 1, 'allocation detail retains historical consumption')
reset()
grant({ amount: 3, validTo: '2026-01-05' })
rejected(() => state().saveRequest({ ...input, endDate: '2026-01-06' }), /2026-01-06/)
assert.equal(planConsumption(state(), 'emp_1', 'type', [{ date: '2026-01-06', amount: 1 }]).ok, false)
reset()
const ongoing = grant({ amount: 3, validTo: '' })
const expiring = grant({ amount: 1, validTo: '2026-01-05' })
const ongoingRequest = request({ endDate: '2026-01-06' })
ok(state().approveRequest(ongoingRequest))
assert.deepEqual(
  state().requests[0].consumptions.map(item => item.allocationId),
  [expiring, ongoing],
  'ongoing grants consumed after expiring grants'
)
assert.equal(
  employeeBalance(state(), 'emp_1', 'type', '2027-01-01').remaining,
  2,
  'ongoing allocations remain available without an end date'
)
reset()
grant({ amount: 1 })
const first = request()
const second = request({ startDate: '2026-01-06', endDate: '2026-01-06' })
ok(state().approveRequest(first))
rejected(() => state().approveRequest(second), /Insufficient/, 'pending approvals compete without reserving')
ok(state().cancelRequest(first, 'Released'))
ok(state().approveRequest(second))
assert.equal(employeeBalance(state(), 'emp_1', 'type', '2026-01-06').remaining, 0)

reset({ ...empty, types: [{ ...recordType, requiresAllocation: false, approval: 'none', payroll: 'unpaid' }] })
rejected(() => state().saveAllocation(allocation), /does not require/)
const automatic = request()
assert.equal(state().requests[0].status, 'approved')
assert.equal(state().requests[0].consumptions.length, 0)
assert.equal(employeeBalance(state(), 'emp_1', 'type', '2026-01-05').taken, 1)
ok(state().cancelRequest(automatic, 'Cancel auto-approved leave'))
reset(hoursData)
grant({ amount: 3 })
const hour1 = request({ startTime: '09:00', endTime: '10:30' })
rejected(() => state().saveRequest({ ...hourly, startTime: '10:00', endTime: '11:00' }), /already/)
const hour2 = request({ startTime: '10:30', endTime: '12:00' })
ok(state().approveRequest(hour1))
ok(state().approveRequest(hour2))
assert.equal(employeeBalance(state(), 'emp_1', 'type', '2026-01-05').remaining, 0)
assert.equal(requestsOverlap(state().requests[0], { ...state().requests[1], status: 'cancelled' }), false)
reset(hoursData)
grant({ amount: 8 })
const minuteCharges = Array.from({ length: 480 }, () => ({ date: '2026-01-05', amount: 1 / 60 }))
const minutePlan = planConsumption(state(), 'emp_1', 'type', minuteCharges)
assert.equal(minutePlan.ok, true, 'minute fractions cannot accumulate a fictitious balance shortfall')
assert.ok(Math.abs(minutePlan.consumptions.reduce((sum, item) => sum + item.amount, 0) - 8) < 1e-8)
reset(hoursData)
grant({ amount: 20 })
request({ startTime: '09:00', endTime: '13:00' })
rejected(
  () => state().saveRequest({ ...hourly, startTime: '13:00', endTime: '18:00' }),
  /Combined/,
  'split requests cannot exceed daily net hours'
)
const short = request({ startTime: '13:00', endTime: '17:00' })
ok(state().cancelRequest(short, 'Changed hours'))
const shortReplacement = request({ startTime: '13:00', endTime: '17:00' })
ok(state().approveRequest(shortReplacement))

reset()
grant()
const scheduleChanged = request({ endDate: '2026-01-06' })
useSchedulesStore.setState({
  schedules: [{ id: 'monday', slots: [{ day: 0, start: '09:00', end: '18:00', breakMinutes: 60 }] }],
  assignments: { emp_1: 'monday' }
})
rejected(() => state().approveRequest(scheduleChanged), /schedule changed/)
useSchedulesStore.setState({ schedules: [], assignments: {} })
ok(state().saveType({ ...type, active: false }, 'type'))
rejected(() => state().approveRequest(scheduleChanged), /active/)
for (const method of ['approveRequest', 'approveAllocation', 'removeRequest', 'removeAllocation', 'removeType'])
  rejected(() => state()[method]('missing'))
const fixture = structuredClone(empty)
useTimeOffStore.setState({ types: [], allocations: [], requests: [], hasHydrated: false })
state().initialize(fixture)
const initialized = state()
state().initialize(empty)
assert.equal(state(), initialized, 'hydration runs once')
fixture.types[0].name = 'Mutated externally'
assert.notEqual(state().types[0].name, fixture.types[0].name, 'input is defensively cloned')
assert.equal(useEmployeesStore.getState(), unrelated.employees, 'leave never rewrites employees')
assert.deepEqual(
  useSchedulesStore.getState().schedules,
  unrelated.schedules.schedules,
  'leave never rewrites schedules'
)
console.log(
  'PASS: leave policies, date/schedule/hour validation, approved allocations, per-date expiry-first consumption, atomic approvals, cancellation restoration, overlap/refusal/history guards and defensively cloned initialization.'
)
