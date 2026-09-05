import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const source = readFileSync(root + 'config/app-navigation.ts', 'utf8')
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const loaded = { exports: {} }
new Function('require', 'module', 'exports', output)(createRequire(import.meta.url), loaded, loaded.exports)
const { appNavigation, navigationDestinations, getActiveNavigationDestination, isNavigationItemActive, getNavigationForRole, getNavigationLabel } = loaded.exports
const main = appNavigation.find(group => group.id === 'main')
const items = appNavigation.flatMap(group => group.items)
assert.equal(new Set(items.map(item => item.iconClassName)).size, items.length, 'Each module keeps its own icon colour')
for (const item of items) assert.match(item.iconClassName, /^text-[a-z]+-600$/, `Missing icon colour: ${item.id}`)
assert.deepEqual(main.items.map(item => item.label), ['Employees', 'Contracts', 'Attendance', 'Time off', 'Payroll', 'Reports'])
assert.deepEqual(main.items.find(item => item.id === 'time-off').children.map(item => item.label), ['Requests', 'Allocations', 'Time off types'])
assert.deepEqual(main.items.find(item => item.id === 'payroll').children.map(item => item.label), ['Payruns', 'Payslips', 'Salary structures', 'Salary rules'])
assert.ok(navigationDestinations.some(item => item.id === 'working-schedules'))
for (const id of ['attendance-records', 'working-schedules']) {
  assert.equal(navigationDestinations.find(item => item.id === id)?.status, 'ready', `${id} must stay linked in the sidebar`)
}
for (const id of ['time-off-requests', 'time-off-allocations', 'time-off-types', 'payruns', 'payslips', 'salary-structures', 'salary-rules', 'dashboard', 'hr-payroll-reports']) {
  assert.equal(navigationDestinations.find(item => item.id === id)?.status, 'planned', `${id} must stay disabled in the sidebar`)
}
assert.ok(navigationDestinations.some(item => item.id === 'users-roles'))
assert.equal(new Set(navigationDestinations.map(item => item.id)).size, navigationDestinations.length)
assert.equal(new Set(navigationDestinations.map(item => item.href)).size, navigationDestinations.length)
for (const destination of navigationDestinations.filter(item => item.status === 'ready')) {
  assert.ok(existsSync(root + 'app/(app)' + destination.href + '/page.tsx'), `Missing ready route: ${destination.href}`)
}
for (const [pathname, expected] of [
  ['/employees', 'employees'], ['/employees/per_1', 'employees'],
  ['/contracts', 'contracts'], ['/contracts/ctr_demo_1', 'contracts'],
  ['/attendance', 'attendance-records'], ['/attendance/att_demo_1', 'attendance-records'],
  ['/dashboards/analytics', 'dashboard'], ['/dashboard', 'dashboard'],
  ['/kanban/opp_4', 'kanban'], ['/opportunities/opp_4', 'kanban'],
  ['/attendance/schedules/weekly', 'working-schedules'],
  ['/time-off/requests/leave_demo_pending_0', 'time-off-requests'],
  ['/time-off/allocations/leave_grant_pending', 'time-off-allocations'],
  ['/time-off/types/leave_annual', 'time-off-types'],
  ['/payroll/rules', 'salary-rules'], ['/payroll/run_1', 'payruns'],
  ['/settings/users', 'users-roles'], ['/settings', 'system-settings'],
  ['/employees-archive', undefined], ['/not-a-page', undefined],
]) assert.equal(getActiveNavigationDestination(pathname)?.id, expected, pathname)
assert.equal(isNavigationItemActive(main.items.find(item => item.id === 'payroll'), '/payroll/rules'), true)
assert.equal(isNavigationItemActive(main.items.find(item => item.id === 'reports'), '/dashboards/analytics'), true)
const employeeGroups = getNavigationForRole('employee')
const employeeItems = employeeGroups.flatMap(group => group.items)
assert.deepEqual(employeeItems.map(item => item.label), ['My Attendance', 'My Profile'])
assert.ok(employeeItems.every(item => !('children' in item)), 'Employee destinations are direct links, not nested management menus')
assert.equal(employeeItems[0].href, '/attendance')
assert.equal(employeeItems[1].href, '/employees')
assert.equal(isNavigationItemActive(employeeItems[0], '/attendance'), true)
assert.equal(isNavigationItemActive(employeeItems[0], '/attendance/record-id'), true)
assert.equal(isNavigationItemActive(employeeItems[0], '/attendance/schedules'), false)
assert.equal(getNavigationLabel('/attendance', 'employee'), 'My Attendance')
assert.equal(getNavigationLabel('/employees', 'employee'), 'My Profile')
assert.equal(getNavigationLabel('/contracts', 'employee'), undefined)
for (const role of ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager']) {
  assert.equal(getNavigationForRole(role), appNavigation, `${role} keeps management navigation`)
  assert.equal(getNavigationLabel('/attendance', role), 'Attendance records')
}
assert.deepEqual(getNavigationForRole('unknown'), [])
for (const file of ['components/layout/app-sidebar.tsx', 'components/layout/app-header.tsx']) {
  assert.match(readFileSync(root + file, 'utf8'), /getNavigationForRole|getNavigationLabel/)
}
console.log('PASS: role-specific navigation, flat employee links, matching header labels, management menus, ready routes and active states.')
