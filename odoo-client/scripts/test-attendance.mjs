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


const { validateAttendance, workedMinutes, hoursLabel, attendanceStatus, localDateTime } = load('features/attendance/types.ts')
const { validateSchedule, weeklyMinutes } = load('features/working-schedules/types.ts')
const base = { employeeId: 'emp_1', checkIn: '2026-01-05T09:00', checkOut: '2026-01-05T18:00', breakMinutes: 60, note: '' }
const existing = { ...base, id: 'att_1', corrections: [], createdAt: '2026-01-05T09:00:00Z' }
const ids = ['emp_1', 'emp_2']
assert.equal(workedMinutes(base), 480)
assert.equal(hoursLabel(480), '8h 0m')
assert.equal(workedMinutes({ ...base, checkOut: undefined }), undefined)
assert.equal(validateAttendance(base, [], ids), null)
for (const change of [{ employeeId: 'missing' }, { checkIn: '2026-02-30T09:00' }, { checkIn: 'invalid' }, { checkIn: '2099-01-01T09:00' }, { checkOut: '2099-01-01T09:00' }, { checkOut: '2026-01-05T08:59' }, { checkOut: '2026-01-05T09:00' }, { breakMinutes: 540 }, { breakMinutes: -1 }, { breakMinutes: NaN }, { breakMinutes: 0.5 }]) assert.ok(validateAttendance({ ...base, ...change }, [], ids), JSON.stringify(change))
assert.match(validateAttendance(base, [existing], ids), /overlap/)
assert.equal(validateAttendance(base, [existing], ids, existing.id), null)
assert.equal(validateAttendance({ ...base, employeeId: 'emp_2' }, [existing], ids), null)
assert.equal(validateAttendance({ ...base, checkIn: '2026-01-05T18:00', checkOut: '2026-01-05T20:00', breakMinutes: 0 }, [existing], ids), null, 'adjacent shifts are allowed')
assert.match(validateAttendance({ ...base, checkIn: '2026-01-06T09:00', checkOut: undefined }, [{ ...existing, checkOut: undefined }], ids), /open check-in/)
assert.equal(workedMinutes({ ...base, checkIn: '2026-01-05T22:00', checkOut: '2026-01-06T06:00', breakMinutes: 30 }), 450, 'attendance supports overnight intervals')
assert.equal(attendanceStatus(base, '2026-01-05'), 'complete')
assert.equal(attendanceStatus({ ...base, checkOut: undefined }, '2026-01-05'), 'open')
assert.equal(attendanceStatus({ ...base, checkOut: undefined }, '2026-01-06'), 'missing')

const schedule = { name: 'Standard', type: 'full-time', slots: [0,1,2,3,4].map(day => ({ day, start: '09:00', end: '18:00', breakMinutes: 60 })) }
assert.equal(validateSchedule(schedule), null)
assert.equal(weeklyMinutes(schedule), 2400)
assert.ok(validateSchedule({ ...schedule, name: '' }))
assert.ok(validateSchedule({ ...schedule, slots: [] }))
for (const slot of [{ day: 7, start: '09:00', end: '18:00', breakMinutes: 60 }, { day: 0, start: '25:00', end: '18:00', breakMinutes: 60 }, { day: 0, start: '18:00', end: '09:00', breakMinutes: 0 }, { day: 0, start: '09:00', end: '10:00', breakMinutes: 60 }]) assert.ok(validateSchedule({ ...schedule, slots: [slot] }))
assert.match(validateSchedule({ ...schedule, slots: [schedule.slots[0], schedule.slots[0]] }), /overlap/)
assert.equal(validateSchedule({ ...schedule, slots: [{ day: 0, start: '09:00', end: '12:00', breakMinutes: 0 }, { day: 0, start: '12:00', end: '16:00', breakMinutes: 0 }] }), null)

const { useEmployeesStore } = load('features/employees/store.ts')
const { useAttendanceStore } = load('features/attendance/store.ts')
const { useSchedulesStore } = load('features/working-schedules/store.ts')
const { useCurrentActorStore } = load('features/nexacrm/store/use-current-actor-store.ts')
useEmployeesStore.getState().initialize(ids.map(id => ({ id, firstName: id, lastName: '', email: 'test@example.com', createdAt: existing.createdAt, updatedAt: existing.createdAt })))
const employeeState = useEmployeesStore.getState()
useCurrentActorStore.getState().setActorId('usr_test')
const attendance = () => useAttendanceStore.getState()
attendance().initialize([existing])
attendance().initialize([])
assert.equal(attendance().records.length, 1)
const before = attendance()
assert.equal(attendance().save(base, existing.id, 'No change').ok, false)
assert.equal(attendance().save(base).ok, false)
assert.equal(attendance().save({ ...base, checkOut: '2026-01-05T17:00' }, existing.id).ok, false, 'corrections require a reason')
assert.equal(attendance(), before, 'failed writes are atomic')
assert.equal(attendance().save(base, 'missing', 'reason').ok, false)
assert.equal(attendance().save({ ...base, checkOut: '2026-01-05T17:00', status: 'derived' }, existing.id, 'Early departure correction').ok, true)
const changed = attendance().records[0]
assert.equal(changed.corrections.length, 1)
assert.equal(changed.corrections[0].before.checkOut, base.checkOut)
assert.equal(changed.corrections[0].after.checkOut, '2026-01-05T17:00')
assert.equal(changed.corrections[0].actorId, 'usr_test')
assert.equal(Object.hasOwn(changed, 'status'), false)
assert.equal(changed.createdById, undefined)
const made = attendance().save({ ...base, employeeId: 'emp_2' })
assert.equal(made.ok, true)
assert.equal(attendance().records.find(record => record.id === made.id).createdById, 'usr_test')
attendance().remove(made.id)
assert.equal(attendance().records.length, 1)
assert.equal(attendance().checkOut('missing').ok, false)
assert.equal(attendance().checkOut(existing.id).ok, false)
const openAt = new Date(); openAt.setMinutes(openAt.getMinutes() - 10)
const opened = attendance().save({ ...base, employeeId: 'emp_2', checkIn: localDateTime(openAt), checkOut: undefined, breakMinutes: 0 })
assert.equal(opened.ok, true)
if (localDateTime(openAt).slice(0,10) === localDateTime().slice(0,10)) {
  assert.equal(attendance().checkOut(opened.id).ok, true)
  assert.ok(attendance().records.find(record => record.id === opened.id).checkOut)
  assert.equal(attendance().checkOut(opened.id).ok, false)
}
const schedules = () => useSchedulesStore.getState()
schedules().initialize([], {})
const saved = schedules().save({ ...schedule, name: '  Standard  ', weeklyMinutes: 1 })
assert.equal(saved.ok, true)
assert.equal(schedules().schedules[0].name, 'Standard')
assert.equal(Object.hasOwn(schedules().schedules[0], 'weeklyMinutes'), false)
assert.equal(schedules().assign('missing', saved.id).ok, false)
assert.equal(schedules().assign('emp_1', 'missing').ok, false)
assert.equal(schedules().assign('emp_1', saved.id).ok, true)
assert.equal(schedules().remove(saved.id).ok, false, 'assigned schedules cannot be deleted')
const second = schedules().save({ ...schedule, name: 'Other' })
assert.equal(schedules().assign('emp_1', second.id).ok, true)
assert.equal(schedules().assignments.emp_1, second.id, 'reassignment replaces the previous schedule')
assert.equal(schedules().remove(saved.id).ok, true)
assert.equal(schedules().assign('emp_1').ok, true)
assert.equal(schedules().remove(second.id).ok, true)
assert.equal(schedules().schedules.length, 0)
assert.equal(useEmployeesStore.getState(), employeeState, 'time tracking never rewrites employee identity or CRM data')

for (const file of ['app/(app)/attendance/page.tsx', 'app/(app)/attendance/[id]/page.tsx', 'app/(app)/attendance/schedules/page.tsx', 'app/(app)/attendance/schedules/[id]/page.tsx']) assert.ok(read(file))
assert.match(read('features/attendance/index.tsx'), /RecordCalendar/)
assert.match(read('features/attendance/record-calendar.tsx'), /getPrePaginationRowModel/)
assert.match(read('features/attendance/record-calendar.tsx'), /onOpenRecord\(record\)/)
assert.match(read('features/attendance/employee-attendance.tsx'), /Calendar/)
for (const file of ['features/employees/employee-panel.tsx', 'features/employees/employee-detail.tsx']) {
  assert.match(read(file), /<EmployeeAttendance employeeId=\{employee.id\}/, file + ' must render attendance, not merely import it')
  assert.match(read(file), /<TabsTrigger value="attendance">/)
  assert.match(read(file), /<TabsContent value="attendance">/)
}
// Employee profiles now display the backend schedule text; the separate
// working-schedule assignment store remains disconnected until its API lands.
assert.match(read('features/employees/components/employee-fields.tsx'), /employee\.workingSchedule/)
assert.doesNotMatch(read('features/employees/components/employee-fields.tsx'), /<EmployeeSchedule/)
assert.match(read('features/employees/components/employee-fields.tsx'), /<EmployeeAttendanceLink employeeId=\{employee.id\}/)
const initializer = read('features/hr/data-stores-initializer.tsx')
assert.match(initializer, /useAttendanceStore.getState\(\).initialize\(\[\]\)/)
assert.match(initializer, /useSchedulesStore.getState\(\).initialize\(\[\], \{\}\)/)
assert.match(read('features/hr/components/records-table.tsx'), /table-container/)
console.log('PASS: attendance dates/hours/overlaps, correction snapshots, checkout, schedule totals/overlaps, assignments/deletion guards and integrated views.')
