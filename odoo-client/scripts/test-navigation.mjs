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
const { appNavigation, navigationDestinations, getActiveNavigationDestination, isNavigationItemActive } = loaded.exports
const main = appNavigation.find(group => group.id === 'main')
const items = appNavigation.flatMap(group => group.items)
assert.equal(new Set(items.map(item => item.iconClassName)).size, items.length, 'Each module keeps its own icon colour')
for (const item of items) assert.match(item.iconClassName, /^text-[a-z]+-600$/, `Missing icon colour: ${item.id}`)
assert.deepEqual(main.items.map(item => item.label), ['Employees', 'Contracts', 'Attendance', 'Time off', 'Payroll', 'Reports'])
assert.deepEqual(main.items.find(item => item.id === 'time-off').children.map(item => item.label), ['Requests', 'Allocations', 'Time off types'])
assert.deepEqual(main.items.find(item => item.id === 'payroll').children.map(item => item.label), ['Payruns', 'Payslips', 'Salary structures', 'Salary rules'])
assert.ok(navigationDestinations.some(item => item.id === 'working-schedules'))
assert.ok(navigationDestinations.some(item => item.id === 'users-roles'))
assert.equal(new Set(navigationDestinations.map(item => item.id)).size, navigationDestinations.length)
assert.equal(new Set(navigationDestinations.map(item => item.href)).size, navigationDestinations.length)
for (const destination of navigationDestinations.filter(item => item.status === 'ready')) {
  assert.ok(existsSync(root + 'app/(app)' + destination.href + '/page.tsx'), `Missing ready route: ${destination.href}`)
}
for (const [pathname, expected] of [
  ['/employees', 'employees'], ['/employees/per_1', 'employees'],
  ['/dashboards/analytics', 'dashboard'], ['/dashboard', 'dashboard'],
  ['/kanban/opp_4', 'kanban'], ['/opportunities/opp_4', 'kanban'],
  ['/attendance/schedules/weekly', 'working-schedules'],
  ['/payroll/rules', 'salary-rules'], ['/payroll/run_1', 'payruns'],
  ['/settings/users', 'users-roles'], ['/settings', 'system-settings'],
  ['/employees-archive', undefined], ['/not-a-page', undefined],
]) assert.equal(getActiveNavigationDestination(pathname)?.id, expected, pathname)
assert.equal(isNavigationItemActive(main.items.find(item => item.id === 'payroll'), '/payroll/rules'), true)
assert.equal(isNavigationItemActive(main.items.find(item => item.id === 'reports'), '/dashboards/analytics'), true)
console.log('PASS: six main modules, required setup menus, unique destinations, ready routes, aliases and nested active states.')
