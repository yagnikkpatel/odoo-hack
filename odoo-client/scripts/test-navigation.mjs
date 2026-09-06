import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const require = createRequire(import.meta.url)
const modules = new Map()
function load(file) {
  if (modules.has(file)) return modules.get(file).exports
  const loaded = { exports: {} }
  modules.set(file, loaded)
  const source = readFileSync(file, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = name => {
    if (name.startsWith('@/')) return load(root + name.slice(2) + '.ts')
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name) + '.ts')
    return require(name)
  }
  new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports)
  return loaded.exports
}
const {
  appNavigation, navigationDestinations, getActiveNavigationDestination,
  isNavigationItemActive, getNavigationForRole, getNavigationForUser,
  getNavigationLabel, canAccessNavigationRoute,
} = load(root + 'config/app-navigation.ts')
const items = appNavigation.flatMap(group => group.items)
assert.equal(new Set(items.map(item => item.iconClassName)).size, items.length)
assert.equal(new Set(navigationDestinations.map(item => item.id)).size, navigationDestinations.length)
assert.equal(new Set(navigationDestinations.map(item => item.href)).size, navigationDestinations.length)
for (const destination of navigationDestinations) {
  assert.equal(destination.status, 'ready')
  assert.ok(existsSync(root + 'app/(app)' + destination.href + '/page.tsx'), `Missing route: ${destination.href}`)
}
for (const [pathname, expected] of [
  ['/employees', 'employees'], ['/employees/person_1', 'employees'],
  ['/contracts', 'contracts'], ['/contracts/contract_1', 'contracts'],
  ['/attendance', 'attendance'], ['/attendance/record_1', 'attendance'],
  ['/dashboards/analytics', 'dashboard'], ['/dashboard', 'dashboard'],
  ['/time-off/requests/request_1', 'time-off-requests'],
  ['/time-off/allocations/allocation_1', 'time-off-allocations'],
  ['/time-off/types/type_1', 'time-off-types'],
  ['/payroll/rules', 'salary-rules'], ['/payroll/run_1', 'payruns'],
  ['/employees-archive', undefined], ['/not-a-page', undefined],
]) assert.equal(getActiveNavigationDestination(pathname)?.id, expected, pathname)

const destinations = groups => groups.flatMap(group => group.items.flatMap(item => 'children' in item ? item.children : [item]))
const employeeItems = destinations(getNavigationForRole('employee'))
assert.deepEqual(employeeItems.map(item => item.label), ['My Attendance', 'Time off', 'My Profile'])
assert.equal(isNavigationItemActive(employeeItems[0], '/attendance'), true)
assert.equal(getNavigationLabel('/attendance', 'employee'), 'My Attendance')
assert.equal(getNavigationLabel('/employees', 'employee'), 'My Profile')
assert.equal(getNavigationLabel('/contracts', 'employee'), undefined)
assert.deepEqual(destinations(getNavigationForRole('hr_manager')).map(item => item.id), [
  'employees', 'contracts', 'attendance', 'time-off-requests', 'time-off-allocations', 'time-off-types',
])
for (const role of ['admin', 'hr_payroll_user', 'hr_payroll_manager']) {
  assert.deepEqual(destinations(getNavigationForRole(role)).map(item => item.id), navigationDestinations.map(item => item.id))
  assert.equal(getNavigationLabel('/attendance', role), 'Attendance')
}
assert.deepEqual(getNavigationForRole('unknown'), [])
assert.deepEqual(getNavigationForUser({ role: 'admin', permissions: [] }), [])
const payslipsOnly = { role: 'hr_payroll_user', permissions: ['payslip:read'] }
assert.deepEqual(destinations(getNavigationForUser(payslipsOnly)).map(item => item.id), ['payslips', 'dashboard', 'hr-payroll-reports'])
assert.equal(getNavigationLabel('/payroll', payslipsOnly), undefined)
assert.equal(getNavigationLabel('/payslips', payslipsOnly), 'Payslips')
assert.equal(canAccessNavigationRoute('/payroll/run_1', payslipsOnly), false)
assert.equal(canAccessNavigationRoute('/payslips/slip_1', payslipsOnly), true)
for (const pathname of ['/contracts', '/payroll', '/payroll/rules', '/payslips', '/reports', '/dashboard', '/time-off/types', '/time-off/allocations', '/attendance/record_1']) {
  assert.equal(canAccessNavigationRoute(pathname, { role: 'employee' }), false, pathname)
}
for (const pathname of ['/attendance', '/employees', '/employees/person_1', '/time-off/requests', '/time-off/requests/request_1']) {
  assert.equal(canAccessNavigationRoute(pathname, { role: 'employee' }), true, pathname)
}
for (const role of ['admin', 'employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager']) {
  for (const pathname of ['/kanban', '/kanban/opportunity_1', '/opportunities', '/opportunities/opportunity_1']) {
    assert.equal(canAccessNavigationRoute(pathname, { role }), false, `${role} must not access CRM template ${pathname}`)
  }
  assert.equal(canAccessNavigationRoute('/not-a-page', { role }), true, 'Unknown URLs retain the regular not-found UI')
}
assert.equal(canAccessNavigationRoute('/reports', { role: 'hr_manager' }), false)
assert.equal(canAccessNavigationRoute('/payroll/rules', { role: 'hr_payroll_user', permissions: ['payrun:read'] }), false)
assert.ok(getNavigationForUser({ role: 'admin', permissions: ['employee:read:any'] }).every(group => group.items.length > 0))
console.log('PASS: role navigation, API permission overrides, hidden empty groups, active labels and direct route UI guards.')
