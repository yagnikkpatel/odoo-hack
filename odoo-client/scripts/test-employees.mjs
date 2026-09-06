import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Test-only API fixtures. No live accounts, database, server or browser is used.
const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const modules = new Map()
function load(relative) {
  let file = path.resolve(root, relative)
  if (!fs.existsSync(file)) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const loadedModule = { exports: {} }
  modules.set(file, loadedModule)
  const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  function localRequire(spec) {
    if (spec === '@/features/nexacrm/contexts/currentUserContext') return { useCurrentUser: () => ({ user: { role: 'admin' } }) }
    if (spec.startsWith('@/')) return load(spec.slice(2))
    if (spec.startsWith('.')) return load(path.resolve(path.dirname(file), spec))
    return requirePackage(spec)
  }
  new Function('require', 'module', 'exports', compiled)(localRequire, loadedModule, loadedModule.exports)
  return loadedModule.exports
}
const read = file => fs.readFileSync(path.join(root, file), 'utf8')
const id = '11111111-1111-4111-8111-111111111111'
const secondId = '22222222-2222-4222-8222-222222222222'
const raw = {
  userId: id, name: 'Test Employee', email: 'employee@example.invalid', role: 'employee',
  status: 'active', jobPosition: 'Engineer', contact: '+10000000000', department: 'Engineering',
  managerId: null, managerName: null, workingSchedule: 'Weekdays', company: 'Test company',
  workLocation: 'Office', location: null, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z'
}
const second = { ...raw, userId: secondId, name: 'Second Employee' }
const summary = { total: 42, active: 40, departments: 4, locations: 2, withManager: 30, withoutManager: 12 }
function pageData(employees, total = employees.length, offset = 0) {
  return { employees, pagination: { total, limit: 15, offset, hasMore: offset + employees.length < total }, summary }
}
function response(data, status = 200) {
  if (status >= 400) return new Response(JSON.stringify({ success: false, message: data }), { status })
  return new Response(JSON.stringify({ success: true, data }), { status })
}
const queue = []
const calls = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith('/api/employees'))
  assert.equal(options.credentials, 'same-origin')
  assert.equal(options.cache, 'no-store')
  calls.push({ url, options })
  const next = queue.shift()
  assert.ok(next, 'An unexpected API request was made')
  if (typeof next === 'function') return next()
  return next
}
const state = () => useEmployeesStore.getState()
const { useEmployeesStore } = load('features/employees/store.ts')
const { mapEmployee, mapSummary } = load('features/employees/employee-mapper.ts')
const { employeeName } = load('features/employees/types.ts')
const { employeePermissions } = load('features/employees/permissions.ts')
try {
  const office = { workLatitude: 0, workLongitude: 72.5713621, workRadiusM: 200 }
  const withOffice = mapEmployee({ ...raw, ...office })
  for (const [field, value] of Object.entries(office)) assert.equal(withOffice[field], value)
  assert.equal(mapEmployee(raw).workLatitude, null)
  assert.equal(mapEmployee(raw).workLongitude, null)
  const mapped = mapEmployee(raw)
  assert.equal(mapped.id, id)
  assert.equal(mapped.companyName, raw.company)
  assert.equal(mapped.jobTitle, raw.jobPosition)
  assert.equal(mapped.phone, raw.contact)
  assert.equal(employeeName(mapped), raw.name)
  assert.equal(mapped.managerId, undefined)
  for (const field of ['createdById', 'updatedById', 'employmentType', 'companyId', 'city', 'country']) {
    assert.equal(Object.hasOwn(mapped, field), false, field + ' must not be fabricated')
  }
  assert.deepEqual(mapSummary({ total: null }), { total: 0, active: 0, departments: 0, locations: 0, withManager: 0, withoutManager: 0 })
  assert.throws(() => mapEmployee({ ...raw, userId: 'generated-id' }), /valid employee account ID/)
  assert.equal(mapEmployee({ ...raw, employeeImage: { imageUrl: 'javascript:bad' } }).avatar, undefined)
  const companyImage = { imageUrl: 'https://images.example.invalid/company.png' }
  assert.equal(mapEmployee({ ...raw, companyImage }).companyImage, companyImage.imageUrl)
  assert.equal(mapEmployee({ ...raw, companyImage: null }).companyImage, undefined)
  assert.equal(mapEmployee({ ...raw, companyImage: { imageUrl: 'javascript:bad' } }).companyImage, undefined)
  assert.equal(employeeName({ firstName: '', lastName: '' }), 'Unnamed employee')
  for (const role of ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager']) {
    assert.equal(employeePermissions(role).canCreate, true)
    assert.equal(employeePermissions(role).canDelete, true)
  }
  assert.deepEqual(employeePermissions('employee'), { canRead: true, canReadAll: false, canCreate: false, canUpdate: false, canDelete: false, canManageAccounts: false })
  assert.equal(employeePermissions('unknown').canRead, false)

  assert.deepEqual(state().employees, [])
  assert.equal(state().hasHydrated, false)
  assert.equal('activities' in state(), false)
  queue.push(response(pageData([raw], 42)))
  await state().loadEmployees({ limit: 15, offset: 0, search: 'Engineer', department: 'Engineering' })
  assert.match(calls.at(-1).url, /search=Engineer/)
  assert.equal(state().employees.length, 1)
  assert.equal(state().pagination.total, 42, 'must not treat the current page as the full dataset')
  assert.equal(state().summary.total, 42)
  assert.equal(state().details[id].name, raw.name)

  const before = state().employees
  queue.push(response('The employee could not be updated.', 400))
  await assert.rejects(state().updateEmployee(id, { jobPosition: '' }), /could not be updated/)
  assert.equal(state().employees, before, 'failed update must not change records')

  const updated = { ...raw, department: 'Finance' }
  queue.push(response(updated), response(pageData([updated])))
  await state().updateEmployee(id, { department: 'Finance', managerId: null, location: null })
  const patchCall = calls.findLast(call => call.options.method === 'PATCH')
  assert.deepEqual(JSON.parse(patchCall.options.body), { department: 'Finance', managerId: null, location: null })
  assert.equal(state().employees[0].department, 'Finance')

  let completeCreate
  queue.push(() => new Promise(resolve => { completeCreate = resolve }))
  const pendingCreate = state().addEmployee({
    userId: secondId, jobPosition: 'Engineer', department: 'Engineering', contact: '+10000000000',
    workingSchedule: 'Weekdays', companyName: 'Test company', workLocation: 'Office'
  })
  assert.equal(state().details[secondId], undefined, 'creating must wait for backend confirmation')
  queue.push(response(pageData([updated, second])))
  completeCreate(response(second, 201))
  assert.equal(await pendingCreate, secondId)
  const createCall = calls.find(call => call.options.method === 'POST')
  assert.equal(createCall.url, '/api/employees/' + secondId)
  assert.equal('userId' in JSON.parse(createCall.options.body), false)
  assert.equal(state().details[secondId].id, secondId)

  queue.push(response(undefined), response('Profile has linked records.', 409), response(pageData([second])))
  await assert.rejects(state().deleteEmployees([id, secondId]), /linked records/)
  assert.equal(state().details[id], undefined, 'confirmed deletions must stay deleted')
  assert.equal(state().details[secondId].id, secondId, 'failed deletion must retain its record')
  assert.deepEqual(state().employees.map(employee => employee.id), [secondId])

  queue.push(response(raw))
  await state().loadEmployee(id)
  assert.equal(state().details[id].id, id, 'a direct link must not depend on the current list page')

  let finishOld
  let finishNew
  queue.push(() => new Promise(resolve => { finishOld = resolve }))
  const oldLoad = state().loadEmployees({ limit: 15, offset: 0, search: 'old' })
  queue.push(() => new Promise(resolve => { finishNew = resolve }))
  const newLoad = state().loadEmployees({ limit: 15, offset: 0, search: 'new' })
  finishNew(response(pageData([second])))
  await newLoad
  finishOld(response(pageData([raw])))
  await oldLoad
  assert.equal(state().employees[0].id, secondId, 'late searches cannot replace a newer result')

  queue.push(response('The employee service is unavailable.', 503))
  await assert.rejects(state().loadEmployees(), /unavailable/)
  assert.equal(state().error, 'The employee service is unavailable.')
  assert.equal(state().isLoading, false)
  queue.push(response(pageData([])))
  await state().loadEmployees()
  assert.equal(state().error, null)
  assert.deepEqual(state().employees, [])

  queue.push(response([{ id, name: 'Manager', email: raw.email, role: 'admin' }]), response([]))
  await state().loadOptions()
  assert.equal(state().managers[0].id, id)
  assert.deepEqual(state().accounts, [])
  assert.equal(state().optionsLoading, false)

  assert.equal(queue.length, 0)
  const storeSource = read('features/employees/store.ts')
  assert.doesNotMatch(storeSource, /randomUUID|buildEmployee|getActorId|new Date|activities:|requireDataConnection/)
  assert.doesNotMatch(read('features/hr/data-stores-initializer.tsx'), /useEmployeesStore/)
  console.log('PASS: real employee ID mapping, zero defaults, roles, server pagination, confirmed async CRUD, partial failure, direct links, stale-response protection and no generated records.')
} finally {
  globalThis.fetch = originalFetch
}
