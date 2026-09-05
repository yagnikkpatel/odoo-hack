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
let list = async () => page([])
let getRecord = async () => record
let today = async () => null
let updateBody
let writeError
const api = {
  listAttendances: (...args) => list(...args),
  getAttendance: (...args) => getRecord(...args),
  getMyTodayAttendance: () => today(),
  createAttendance: async input => { if (writeError) throw writeError; return { ...record, ...input } },
  updateAttendance: async (id, input) => { updateBody = input; if (writeError) throw writeError; return { ...record, ...input, id } },
  deleteAttendance: async () => { if (writeError) throw writeError },
  checkIn: async () => ({ ...record, checkOut: null }),
  checkOut: async () => record,
}
function load(relative) {
  let file = path.resolve(root, relative)
  if (!fs.existsSync(file)) file += '.ts'
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = spec => {
    if (file.endsWith('/attendance/store.ts') && spec === './service') return api
    if (spec === '@/features/hr/data-availability') return load('scripts/fixtures/data-connection.ts')
    if (spec.startsWith('@/')) return load(spec.slice(2))
    if (spec.startsWith('.')) return load(path.resolve(path.dirname(file), spec))
    return requirePackage(spec)
  }
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}
const record = {
  id: '11111111-1111-4111-8111-111111111111', employeeId: '22222222-2222-4222-8222-222222222222',
  employeeName: 'Test Employee', employeeEmail: 'employee@example.test', attendanceDate: '2026-01-05',
  checkIn: '2026-01-05T03:30:00.000Z', checkOut: '2026-01-05T11:30:00.000Z',
  workedHours: 8, overtimeHours: 0, status: 'present', editedBy: null, editedByName: null,
  editedAt: null, editReason: null, createdAt: '2026-01-05T03:30:00.000Z', updatedAt: '2026-01-05T11:30:00.000Z',
}
function page(records, offset = 0, total = records.length) {
  return { attendances: records, pagination: { limit: 100, offset, total, hasMore: offset + records.length < total } }
}
const { useAttendanceStore } = load('features/attendance/store.ts')
const store = () => useAttendanceStore.getState()
assert.deepEqual(store().records, [])
assert.equal(store().hasHydrated, false)
list = async () => page([record])
await store().loadRecords({ scope: 'all', limit: 15, offset: 0 })
assert.equal(store().records[0].workedHours, 8)
assert.equal(store().details[record.id], record)

let resolveOld
list = query => query.offset === 0 ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve(page([], 15))
const oldRequest = store().loadRecords({ scope: 'all', limit: 15, offset: 0 })
await store().loadRecords({ scope: 'all', limit: 15, offset: 15 })
resolveOld(page([record]))
await oldRequest
assert.deepEqual(store().records, [], 'old responses cannot overwrite current filters')
assert.equal(store().pagination.offset, 15)

list = async () => { throw new Error('Service unavailable') }
await assert.rejects(store().loadRecords(), /Service unavailable/)
assert.equal(store().error, 'Service unavailable')
const savedId = await store().save({ employeeId: record.employeeId, attendanceDate: record.attendanceDate, overtimeHours: 2 }, record.id)
assert.equal(savedId, record.id, 'refresh failure must not turn a committed write into a failed save')
assert.equal(updateBody.checkIn, null)
assert.equal(updateBody.checkOut, null)
assert.equal(Object.hasOwn(updateBody, 'employeeId'), false)
assert.equal(Object.hasOwn(updateBody, 'attendanceDate'), false)
writeError = new Error('Not allowed')
const beforeWrite = store()
await assert.rejects(store().save({ employeeId: record.employeeId, attendanceDate: record.attendanceDate }), /Not allowed/)
await assert.rejects(store().remove(record.id), /Not allowed/)
assert.equal(store(), beforeWrite)
writeError = undefined

const queriedOffsets = []
list = async query => {
  assert.equal(query.scope, 'own')
  queriedOffsets.push(query.offset)
  return query.offset === 0 ? page([{ ...record, id: 'other' }], 0, 2) : page([record], 1, 2)
}
getRecord = async () => { throw new Error('Own details must not use manager endpoint') }
assert.equal((await store().loadRecord(record.id, 'own')).id, record.id)
assert.deepEqual(queriedOffsets, [0, 1])
list = async () => page([])
await assert.rejects(store().loadRecord('33333333-3333-4333-8333-333333333333', 'own'), error => error.status === 404)
await assert.rejects(store().loadRecord('invalid', 'own'), error => error.status === 400)

today = async () => record
await store().loadToday()
assert.equal(store().today.id, record.id)
assert.equal((await store().checkIn()).checkOut, null)
assert.equal((await store().checkOut()).id, record.id)
today = async () => null
await store().remove(record.id)
assert.equal(store().details[record.id], undefined)
assert.equal(store().today, null)

let resolveDetail
getRecord = () => new Promise(resolve => { resolveDetail = resolve })
const delayedDetail = store().loadRecord(record.id)
await store().remove(record.id)
resolveDetail(record)
await delayedDetail
assert.equal(store().details[record.id], undefined, 'a delayed detail cannot resurrect a deleted record')

getRecord = () => new Promise(resolve => { resolveDetail = resolve })
const outdatedDetail = store().loadRecord(record.id)
const newer = { ...record, workedHours: 7, updatedAt: '2026-01-05T12:30:00.000Z' }
list = async () => page([newer])
await store().loadRecords({ scope: 'all', limit: 15, offset: 0 })
resolveDetail(record)
await outdatedDetail
assert.equal(store().details[record.id].workedHours, 7, 'a delayed detail cannot overwrite a fresher list record')

const { validateSchedule, weeklyMinutes } = load('features/working-schedules/types.ts')
const schedule = { name: 'Standard', type: 'full-time', slots: [0, 1, 2, 3, 4].map(day => ({ day, start: '09:00', end: '18:00', breakMinutes: 60 })) }
assert.equal(validateSchedule(schedule), null)
assert.equal(weeklyMinutes(schedule), 2400)
assert.ok(validateSchedule({ ...schedule, slots: [] }))
assert.match(validateSchedule({ ...schedule, slots: [schedule.slots[0], schedule.slots[0]] }), /overlap/)
const { useEmployeesStore } = load('features/employees/store.ts')
useEmployeesStore.setState({ employees: [{ id: 'emp_1' }] })
const { useSchedulesStore } = load('features/working-schedules/store.ts')
const schedules = () => useSchedulesStore.getState()
schedules().initialize([], {})
const saved = schedules().save(schedule)
assert.equal(saved.ok, true)
assert.equal(schedules().assign('missing', saved.id).ok, false)
assert.equal(schedules().assign('emp_1', saved.id).ok, true)
assert.equal(schedules().remove(saved.id).ok, false)
assert.equal(schedules().assign('emp_1').ok, true)
assert.equal(schedules().remove(saved.id).ok, true)

assert.doesNotMatch(read('features/attendance/store.ts'), /randomUUID|requireDataConnection|corrections|breakMinutes/)
assert.doesNotMatch(read('features/hr/data-stores-initializer.tsx'), /useAttendanceStore/)
assert.doesNotMatch(read('features/payroll/store.ts'), /useAttendanceStore/)
assert.doesNotMatch(read('features/payroll/reporting/index.tsx'), /useAttendanceStore/)
for (const file of ['features/employees/employee-panel.tsx', 'features/employees/employee-detail.tsx']) {
  assert.match(read(file), /<EmployeeAttendance employeeId=\{employee.id\}/)
}
console.log('PASS: attendance store CRUD, own detail pagination, stale responses, refresh failures, payroll isolation, and unchanged schedule behavior.')
