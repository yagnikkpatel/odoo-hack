import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Run pure feature logic with the existing compiler, without adding a test dependency.
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
  const localRequire = spec => {
    if (spec.startsWith('@/')) return load(spec.slice(2) + '.ts')
    if (spec.startsWith('.')) return load(path.resolve(path.dirname(file), spec + '.ts'))
    return requirePackage(spec)
  }
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const { toEmployeePreview, employeeName, EMPLOYEE_VIEW_TYPES } = load('features/employees/types.ts')
const crmPerson = Object.freeze({
  id: 'per_ada', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com',
  jobTitle: 'Engineer', phone: '+10000000000', city: 'London', country: 'UK',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  companyId: 'cmp_1', accountOwnerId: 'usr_1', isPrimary: true,
  linkedin: 'https://example.com/social', x: 'crm-social'
})
const employee = toEmployeePreview(crmPerson)
assert.notEqual(employee, crmPerson)
assert.equal(employeeName(employee), 'Ada Lovelace')
assert.equal(employeeName({ firstName: '', lastName: '' }), 'Unnamed employee')
for (const field of ['companyId', 'accountOwnerId', 'isPrimary', 'linkedin', 'x',
  'department', 'managerId', 'status', 'employmentType']) {
  assert.equal(Object.hasOwn(employee, field), false, `${field} must not be invented from CRM data`)
}
assert.deepEqual(EMPLOYEE_VIEW_TYPES, ['table', 'grid'])

const { usePeopleStore } = load('features/nexacrm/store/use-people-store.ts')
const { useEmployeesStore } = load('features/employees/store.ts')
const { useCurrentActorStore } = load('features/nexacrm/store/use-current-actor-store.ts')
usePeopleStore.getState().initialize([crmPerson])
const crmState = usePeopleStore.getState()
useCurrentActorStore.getState().setActorId('usr_test')
const state = () => useEmployeesStore.getState()
state().initialize([employee])
assert.equal(state().hasHydrated, true)
state().initialize([])
assert.equal(state().employees.length, 1, 'remounting must not erase edits')

const managerId = state().addEmployee({ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' })
assert.match(managerId, /^emp_/)
assert.equal(state().employees[0].createdById, 'usr_test')
assert.equal(state().activities[0].verb, 'created')
state().updateEmployee(employee.id, {
  department: 'Engineering', managerId, status: 'active', employmentType: 'full-time'
})
const updated = state().employees.find(item => item.id === employee.id)
assert.equal(updated.department, 'Engineering')
assert.equal(updated.updatedById, 'usr_test')
assert.deepEqual(state().activities[0].changes, [
  { label: 'Department', value: 'Engineering' },
  { label: 'Manager', value: 'Grace Hopper' },
  { label: 'Status', value: 'Active' },
  { label: 'Employment type', value: 'Full-time' }
])
const activityCount = state().activities.length
state().updateEmployee(employee.id, { status: 'active' })
state().updateEmployee('missing', { status: 'inactive' })
assert.equal(state().activities.length, activityCount, 'no-op edits must not create history')
assert.throws(() => state().updateEmployee(employee.id, { managerId: employee.id }), /own manager/)
assert.throws(() => state().updateEmployee(employee.id, { managerId: 'missing' }), /existing employee/)
state().deleteEmployees([managerId])
assert.equal(state().employees.length, 1)
assert.equal(state().employees[0].managerId, undefined)
assert.equal(state().activities.some(item => item.employeeId === managerId), false)
assert.deepEqual(state().activities[0].changes, [{ label: 'Manager', value: undefined }])
assert.equal(usePeopleStore.getState(), crmState, 'employee CRUD must not mutate CRM state')
assert.equal(crmPerson.accountOwnerId, 'usr_1')
assert.equal(crmPerson.department, undefined)

const { createEmployeeRowParser, EMPLOYEE_IMPORT_FIELDS, employeeCsvRows } = load('features/employees/csv.ts')
const parse = createEmployeeRowParser(state().employees)
assert.equal(parse({}).ok, false)
assert.equal(parse({ name: '   ' }).ok, false)
assert.equal(parse({ name: 'New employee', email: 'bad address' }).ok, false)
assert.equal(parse({ name: 'New employee', status: 'lead' }).ok, false)
assert.equal(parse({ name: 'New employee', employmentType: 'unknown' }).ok, false)
assert.equal(parse({ name: 'New employee', managerId: 'missing' }).ok, false)
const parsed = parse({ name: '  Katherine Johnson  ', email: ' katherine@example.com ',
  department: ' Research ', status: ' ACTIVE ', employmentType: 'Part time', managerId: employee.id,
  companyId: 'Do not import', accountOwnerId: 'Do not import', linkedin: 'Do not import' })
assert.equal(parsed.ok, true)
assert.equal(parsed.input.firstName, 'Katherine')
assert.equal(parsed.input.lastName, 'Johnson')
assert.equal(parsed.input.email, 'katherine@example.com')
assert.equal(parsed.input.department, 'Research')
assert.equal(parsed.input.status, 'active')
assert.equal(parsed.input.employmentType, 'part-time')
assert.equal(parsed.input.managerId, employee.id)
for (const field of ['companyId', 'accountOwnerId', 'linkedin']) {
  assert.equal(Object.hasOwn(parsed.input, field), false)
  assert.equal(EMPLOYEE_IMPORT_FIELDS.some(item => item.key === field), false)
}
assert.equal(parse({ firstName: 'Explicit', lastName: 'Name', name: 'Ignored' }).input.firstName, 'Explicit')
state().addEmployees([parsed.input])
assert.equal(state().employees.length, 2)
assert.equal(state().activities[0].verb, 'created')
const exported = employeeCsvRows([{ ...updated, firstName: '=formula', lastName: '',
  department: '  +formula', phone: '+10000000000' }])[0]
assert.equal(exported.Name, "'=formula")
assert.equal(exported.Department, "'  +formula")
assert.equal(exported.Phone, "'+10000000000")
assert.equal(exported.Status, 'Active')
assert.equal(exported['Employment type'], 'Full-time')
assert.equal(Object.hasOwn(exported, 'Company'), false)

// Guard intentional HR scope while preserving shared template source separately.
const entry = read('features/employees/index.tsx')
assert.doesNotMatch(entry, /PeopleStats|Calendar|PeopleView/)
assert.match(entry, /EmployeesTable/)
assert.match(entry, /EmployeesGrid/)
assert.match(entry, /CreateEmployeeDialog/)
const columns = read('features/employees/table/columns.tsx')
for (const title of ['Name', 'Work email', 'Department', 'Job position', 'Manager', 'Status']) {
  assert.ok(columns.includes(title), `missing ${title} column`)
}
assert.doesNotMatch(columns, /companyId|accountOwnerId|linkedin|isPrimary/)
assert.match(read('features/employees/table/use-employees-table.ts'), /phone: false/)
assert.doesNotMatch(read('features/employees/table/employees-table.tsx'), /TableFooter|showSummary/)
assert.ok(
  read('features/employees/table/employees-table.tsx').includes('[&_[data-slot=table-container]]:border-b'),
  'the table must retain its bottom divider above unused card space without a summary footer'
)
for (const file of ['employee-panel.tsx', 'employee-detail.tsx', 'components/employee-fields.tsx']) {
  assert.doesNotMatch(read('features/employees/' + file), /companyId|accountOwnerId|linkedin|isPrimary|RelatedOpportunities|FavoriteButton|PersonTasks|PersonEmails/)
}
const dialog = read('features/employees/components/create-employee-dialog.tsx')
assert.match(dialog, /onSubmit=\{submit\}/)
assert.match(dialog, /type="button" variant="outline" onClick=\{close\}/)
assert.match(read('app/(app)/employees/page.tsx'), /@\/features\/employees/)
assert.match(read('app/(app)/employees/[id]/page.tsx'), /@\/features\/employees\/employee-detail/)
assert.equal(usePeopleStore.getState(), crmState)
console.log('PASS: employee-only seed, isolated native CRUD/history, manager cleanup, CSV validation/export and reduced UI scope.')
