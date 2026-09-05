import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Isolated React state tests; no attendance is written to a live account.
const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const employeeId = '11111111-1111-4111-8111-111111111111'
const record = {
  id: '22222222-2222-4222-8222-222222222222', employeeId,
  employeeName: 'Test Employee', employeeEmail: 'test@example.invalid',
  attendanceDate: '2026-01-02', checkIn: '2026-01-02T03:30:27.123Z',
  checkOut: '2026-01-02T12:30:48.456Z', workedHours: 9.0059,
  overtimeHours: 1, status: 'present', editedBy: null, editedByName: null,
  editedAt: null, editReason: null, createdAt: '2026-01-02T03:30:27.123Z', updatedAt: '2026-01-02T12:30:48.456Z',
}

function harness(file, { role = 'admin', userId = employeeId, store = {}, service = {}, employeeStore = {} } = {}) {
  const state = []
  const effects = []
  let cursor = 0
  const modules = new Map()
  const mocks = {
    react: {
      useState(initial) {
        const index = cursor++
        if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial
        return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value }]
      },
      useEffect(effect, dependencies) {
        const index = cursor++
        const previous = effects[index]
        if (previous && dependencies.every((value, i) => Object.is(value, previous.dependencies[i]))) return
        previous?.cleanup?.()
        effects[index] = { dependencies, cleanup: effect() }
      },
      useActionState(action, initial) {
        const [value, update] = mocks.react.useState(initial)
        return [value, async (...args) => { const next = await action(value, ...args); update(next); return next }, false]
      },
    },
    'react-dom': { useFormStatus: () => ({ pending: false }) },
    'next/link': { default: 'Link' },
    '@/features/nexacrm/contexts/currentUserContext': { useCurrentUser: () => ({ user: { id: userId, role } }) },
    './store': { useAttendanceStore: selector => selector(store) },
    '@/features/employees/store': { useEmployeesStore: selector => selector(employeeStore) },
    '@/features/nexacrm/components/record/person-avatar': { default: 'PersonAvatar' },
    './service': { listAttendanceEmployees: async () => [], ...service },
    './editor': { default: 'AttendanceEditor' },
    './status-badge': { default: 'AttendanceStatusBadge' },
    '@/features/hr/components/form': { FormField: 'FormField', Choice: 'Choice' },
  }
  function load(relative) {
    let full = path.resolve(root, relative)
    if (!fs.existsSync(full)) full += fs.existsSync(full + '.ts') ? '.ts' : '.tsx'
    if (modules.has(full)) return modules.get(full).exports
    const loaded = { exports: {} }
    modules.set(full, loaded)
    const source = ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    }).outputText
    function localRequire(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('@/features/nexacrm/components/ui/')) return new Proxy({}, { get: (_, key) => key })
      if (name.startsWith('@/')) return load(name.slice(2))
      if (name.startsWith('.')) return load(path.resolve(path.dirname(full), name))
      return requirePackage(name)
    }
    new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
    return loaded.exports
  }
  const exports = load(file)
  function render(props, name = 'default') { cursor = 0; return exports[name](props) }
  return { render }
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined
  if (predicate(node)) return node
  for (const child of [node.props?.children].flat(Infinity)) {
    const match = find(child, predicate)
    if (match) return match
  }
}
const byId = (tree, id) => find(tree, node => node.props?.id === id && node.type !== 'FormField')
const form = tree => find(tree, node => node.type === 'form')
const text = node => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  return [node?.props?.children].flat(Infinity).map(child => child === node ? '' : text(child)).join(' ')
}

const saves = []
const saved = []
let saveError = false
const editor = harness('features/attendance/editor.tsx', { store: { save: async (input, id) => {
  if (saveError) throw new Error('This date already has attendance.')
  saves.push({ input, id })
  return record.id
} } })
const props = { record, onClose() {}, onSaved: id => saved.push(id) }
let tree = editor.render(props)
assert.equal(byId(tree, 'attendance-employee').props.disabled, true)
assert.equal(byId(tree, 'attendance-date').props.disabled, true)
assert.equal(byId(tree, 'attendance-in').props.value, '2026-01-02T09:00')
assert.equal(byId(tree, 'attendance-out').props.value, '2026-01-02T18:00')
assert.equal(byId(tree, 'attendance-out').props.timePlaceholder, 'Time')
assert.match(find(tree, node => node.type === 'DialogContent').props.className, /p-0/)
assert.match(find(tree, node => node.type === 'DialogFooter').props.className, /mb-0/)
assert.match(find(tree, node => node.props?.['data-testid'] === 'attendance-form-body').props.className, /overflow-y-auto/)
assert.ok(!byId(tree, 'attendance-break'))
assert.ok(!byId(tree, 'attendance-note'))
assert.equal((await form(tree).props.action()).error, null)
assert.equal(saves[0].input.checkIn, record.checkIn, 'Unchanged edits preserve seconds and milliseconds')
assert.equal(saves[0].input.checkOut, record.checkOut)
assert.deepEqual(saved, [record.id])

tree = editor.render(props)
byId(tree, 'attendance-in').props.onChange('2026-01-02T10:00')
byId(tree, 'attendance-status').props.onChange('automatic')
byId(tree, 'attendance-reason').props.onChange({ target: { value: '  Correct arrival  ' } })
await form(editor.render(props)).props.action()
assert.equal(saves[1].input.checkIn, '2026-01-02T04:30:00.000Z')
assert.equal(saves[1].input.status, undefined)
assert.equal(saves[1].input.editReason, 'Correct arrival')

tree = editor.render(props)
byId(tree, 'attendance-in').props.onChange('')
assert.match((await form(editor.render(props)).props.action()).error, /check-in before a check-out/)
byId(editor.render(props), 'attendance-out').props.onChange('')
await form(editor.render(props)).props.action()
assert.equal(saves.at(-1).input.checkIn, undefined, 'Store converts an empty edit timestamp to PATCH null')
assert.equal(saves.at(-1).input.checkOut, undefined)
saveError = true
assert.match((await form(editor.render(props)).props.action()).error, /already has attendance/)
assert.match(text(editor.render(props)), /already has attendance/)

for (const [checkIn, checkOut, expected] of [
  ['2026-01-02T10:00', '2026-01-02T09:00', /after check-in/],
  ['2026-01-02T10:00', '2026-01-03T10:01', /exceed 24 hours/],
  ['2026-02-30T10:00', '', /valid date and time/],
  ['2999-01-02T10:00', '', /future/],
]) {
  byId(editor.render(props), 'attendance-in').props.onChange(checkIn)
  byId(editor.render(props), 'attendance-out').props.onChange(checkOut)
  assert.match((await form(editor.render(props)).props.action()).error, expected)
}

const creates = []
const creator = harness('features/attendance/editor.tsx', { store: { save: async input => { creates.push(input); return record.id } } })
const createProps = { onClose() {}, onSaved() {} }
tree = creator.render(createProps)
assert.equal(byId(tree, 'attendance-date').props.disabled, false)
assert.equal(byId(tree, 'attendance-reason'), undefined)
assert.match((await form(tree).props.action()).error, /Select an employee/)
await new Promise(resolve => setImmediate(resolve))
byId(creator.render(createProps), 'attendance-employee').props.onChange(employeeId)
byId(creator.render(createProps), 'attendance-date').props.onChange('2026-01-02')
byId(creator.render(createProps), 'attendance-in').props.onChange('')
await form(creator.render(createProps)).props.action()
assert.deepEqual(creates[0], { employeeId, attendanceDate: '2026-01-02', checkIn: undefined, checkOut: undefined, overtimeHours: 0, status: undefined, editReason: undefined })

const denied = harness('features/attendance/editor.tsx', { role: 'employee', store: { save: () => { throw new Error('Must not call') } } })
assert.match((await form(denied.render(props)).props.action()).error, /permission/)
const employeeActions = harness('features/attendance/record-actions.tsx', { role: 'employee', store: {} })
assert.equal(employeeActions.render({ record, detail: true, onEdit() {} }), null)
assert.doesNotMatch(text(employeeActions.render({ record, onEdit() {} })), /Correct attendance|Delete attendance/)
for (const role of ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager']) {
  const actions = harness('features/attendance/record-actions.tsx', { role, store: {} })
  assert.match(text(actions.render({ record, detail: true, onEdit() {} })), /Correct attendance/)
}
let removed = 0
const actions = harness('features/attendance/record-actions.tsx', { store: { remove: async () => { removed++; throw new Error('Unable to delete this record.') } } })
await form(actions.render({ record, onEdit() {} })).props.action()
assert.equal(removed, 1)
assert.match(text(actions.render({ record, onEdit() {} })), /Unable to delete/)

let employeeReads = 0
const panel = harness('features/attendance/employee-attendance.tsx', {
  role: 'employee', userId: 'another-user',
  service: { listAttendances: async () => { employeeReads++; return { attendances: [], pagination: { total: 0 } } } },
})
assert.match(text(panel.render({ employeeId })), /only view your own/)
assert.equal(panel.render({ employeeId }, 'EmployeeAttendanceLink'), null)
assert.equal(employeeReads, 0)

let detailScope
const hookStore = { records: [], details: {}, loadRecord: async (_id, scope) => { detailScope = scope; throw new Error('Attendance record not found.') } }
const hook = harness('features/attendance/use-attendance-record.ts', { role: 'employee', store: hookStore })
assert.equal(hook.render(record.id, 'useAttendanceRecord').loading, true)
await new Promise(resolve => setImmediate(resolve))
assert.equal(detailScope, 'own')
assert.match(hook.render(record.id, 'useAttendanceRecord').error, /not found/)
hookStore.details[record.id] = record
assert.equal(hook.render(record.id, 'useAttendanceRecord').record, record)
const otherUserHook = harness('features/attendance/use-attendance-record.ts', { role: 'employee', userId: 'another-user', store: { ...hookStore, loadRecord: async () => { throw new Error('Not found') } } })
assert.equal(otherUserHook.render(record.id, 'useAttendanceRecord').record, undefined, 'An own-only viewer never sees another cached user record')
await new Promise(resolve => setImmediate(resolve))

const originalWindow = globalThis.window
let avatarReads = 0
const employeeCache = { employees: [], details: {}, loadEmployee: async id => {
  avatarReads++
  employeeCache.details[id] = { id, avatar: 'https://example.test/photo.png' }
} }
const avatar = harness('features/attendance/employee-avatar.tsx', { employeeStore: employeeCache })
tree = avatar.render({ employeeId, name: 'Test Employee' })
assert.equal(tree.props.src, undefined, 'Initials remain visible while the profile loads')
await new Promise(resolve => setImmediate(resolve))
assert.equal(avatar.render({ employeeId, name: 'Test Employee' }).props.src, 'https://example.test/photo.png')
assert.equal(avatarReads, 1)
employeeCache.details[employeeId].avatar = undefined
assert.equal(avatar.render({ employeeId, name: 'Test Employee' }).props.src, undefined, 'Deleted photos return to initials')
assert.equal(avatarReads, 1, 'A profile without a photo does not trigger repeated requests')
employeeCache.details[employeeId].avatar = 'https://example.test/private.png'
const forbiddenAvatar = harness('features/attendance/employee-avatar.tsx', { role: 'employee', userId: 'other-user', employeeStore: employeeCache })
assert.equal(forbiddenAvatar.render({ employeeId, name: 'Other Employee' }).props.src, undefined)
assert.equal(avatarReads, 1, 'Employees cannot load another account’s profile photo')
const ownAvatar = harness('features/attendance/employee-avatar.tsx', { role: 'employee', employeeStore: employeeCache })
assert.equal(ownAvatar.render({ employeeId, name: 'Test Employee' }).props.src, 'https://example.test/private.png')
const missingAvatar = harness('features/attendance/employee-avatar.tsx', { employeeStore: { employees: [], details: {}, loadEmployee: async () => { throw new Error('No profile') } } })
assert.equal(missingAvatar.render({ employeeId, name: 'Test Employee' }).props.src, undefined)
await new Promise(resolve => setImmediate(resolve))

globalThis.window = { addEventListener() {}, removeEventListener() {}, setInterval() { return 1 }, clearInterval() {} }
try {
  let checks = 0
  const clockStore = { today: null, todayLoading: false, todayError: 'Service unavailable', loadToday: async () => {}, checkIn: async () => { checks++ }, checkOut: async () => { checks++ } }
  const clock = harness('features/attendance/today-card.tsx', { role: 'employee', store: clockStore })
  tree = clock.render({})
  assert.match(text(tree), /Attendance unavailable/)
  assert.doesNotMatch(text(tree), /Ready to start your day|You have not checked in/)
  assert.equal(form(tree), undefined, 'Unavailable attendance offers retry, not disabled clock forms')
  await new Promise(resolve => setImmediate(resolve))
  clockStore.todayError = null
  tree = clock.render({})
  assert.match(text(tree), /Ready to start your day/)
  const input = new FormData()
  input.set('action', 'in')
  await form(tree).props.action(input)
  assert.equal(checks, 1)
  clockStore.today = { ...record, checkOut: null }
  tree = clock.render({})
  assert.match(text(tree), /You’re checked in/)
  const mainClockButton = find(tree, node => node.type?.name === 'ClockButton')
  assert.equal(mainClockButton.props.action, 'out')
  assert.equal(mainClockButton.props.disabled, false)
  clockStore.today = { ...record, checkIn: null, checkOut: null, status: 'absent' }
  tree = clock.render({})
  assert.match(text(tree), /Contact HR/)
  assert.equal(find(tree, node => node.type?.name === 'ClockButton' && node.props.action === 'in'), undefined)
  clockStore.today = record
  assert.match(text(clock.render({})), /You’re checked out/)
} finally {
  globalThis.window = originalWindow
}

console.log('PASS: attendance forms, role gates, employee scopes, direct details, and clock loading/error/check-in/check-out states (isolated component tests).')
