import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Exercises the UI contract with role defaults and live permission overrides.
// No database, API requests, or real user accounts are modified.
const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const modules = new Map()
function load(relative) {
  let file = path.resolve(root, relative)
  if (!existsSync(file)) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const loaded = { exports: {} }
  modules.set(file, loaded)
  const output = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = spec => spec.startsWith('@/')
    ? load(spec.slice(2))
    : spec.startsWith('.') ? load(path.resolve(path.dirname(file), spec)) : requirePackage(spec)
  new Function('require', 'module', 'exports', output)(localRequire, loaded, loaded.exports)
  return loaded.exports
}
const permissions = load('features/auth/permissions.ts')
const { moduleAccess, payrollAccess, employeeAccess, attendanceAccess, timeOffAccess, contractAccess, rolePermissions, hasPermission } = permissions

// Expected effective grants confirmed against the database and API route guards.
// Payroll reporting currently requires payslip:read, even though HR has the
// separate payroll_dashboard:read code in its role configuration.
const expected = {
  employee: { allPeople: false, contracts: false, payroll: false, configure: false, removePayroll: false, accounts: false },
  hr_manager: { allPeople: true, contracts: true, payroll: false, configure: false, removePayroll: false, accounts: false },
  hr_payroll_user: { allPeople: true, contracts: true, payroll: true, configure: false, removePayroll: false, accounts: false },
  hr_payroll_manager: { allPeople: true, contracts: true, payroll: true, configure: true, removePayroll: true, accounts: false },
  admin: { allPeople: true, contracts: true, payroll: true, configure: true, removePayroll: true, accounts: true },
}
for (const [role, want] of Object.entries(expected)) {
  const actor = { role }
  const access = moduleAccess(actor)
  assert.equal(access.employees.canRead, true, `${role}: own profile remains available`)
  assert.equal(access.employees.canReadAll, want.allPeople, `${role}: employee directory`)
  assert.equal(access.employees.canCreate, want.allPeople, `${role}: employee creation`)
  assert.equal(access.employees.canManageAccounts, want.accounts, `${role}: login account creation`)
  assert.equal(access.attendance.canReadOwn, true, `${role}: own attendance`)
  assert.equal(access.attendance.canReadAny, want.allPeople, `${role}: team attendance`)
  assert.equal(access.timeOff.canReadOwn, true, `${role}: own time off`)
  assert.equal(access.timeOff.canCreateOwn, true, `${role}: own time off request`)
  assert.equal(access.timeOff.canApprove, want.allPeople, `${role}: time off approval`)
  assert.equal(access.contracts.canRead, want.contracts, `${role}: contract access`)
  assert.equal(access.payroll.canRead, want.payroll, `${role}: payroll access`)
  assert.equal(access.payroll.canReport, want.payroll, `${role}: reporting matches actual API guard`)
  assert.equal(access.payroll.canConfigure, want.configure, `${role}: payroll configuration`)
  assert.equal(access.payroll.canDelete, want.removePayroll, `${role}: payroll delete`)
  assert.equal(access.payroll.canSend, want.payroll, `${role}: payslip delivery`)
  const defaults = rolePermissions(role)
  assert.equal(new Set(defaults).size, defaults.length, `${role}: duplicate grants`)
  assert.deepEqual(moduleAccess({ role, permissions: defaults }), access, `${role}: explicit permissions agree with role fallback`)
  const revoked = moduleAccess({ role, permissions: [] })
  for (const [moduleName, flags] of Object.entries(revoked)) {
    for (const [flag, value] of Object.entries(flags)) {
      if (flag.startsWith('can')) assert.equal(value, false, `${role}: revoked ${moduleName}.${flag} stays hidden`)
    }
  }
}
assert.deepEqual(rolePermissions('unknown'), [])
assert.equal(employeeAccess({ role: 'unknown' }).canRead, false)
assert.equal(payrollAccess({ role: 'unknown' }).canRead, false)
assert.equal(hasPermission({ role: 'admin', permissions: [] }, 'employee:read:any'), false)
assert.equal(employeeAccess({ role: 'employee', permissions: ['employee:read:any'] }).canReadAll, true)
assert.equal(employeeAccess({ role: 'admin', permissions: ['employee:read:own'] }).canCreate, false)
assert.equal(contractAccess({ role: 'hr_manager', permissions: ['contract:read'] }).canUpdate, false)
assert.equal(attendanceAccess({ role: 'employee', permissions: ['attendance:read:own'] }).canCheckIn, false)
assert.equal(timeOffAccess({ role: 'employee', permissions: ['time_off:read:own'] }).canCreateOwn, false)
assert.equal(payrollAccess({ role: 'hr_manager', permissions: ['payroll_dashboard:read'] }).canReport, false)
assert.equal(payrollAccess({ role: 'admin', permissions: ['payrun:read'] }).canReport, false)
assert.equal(payrollAccess({ role: 'employee', permissions: ['payslip:read'] }).canReport, true)
assert.equal(payrollAccess({ role: 'admin', permissions: ['payrun:update'] }).canProcess, false)
assert.equal(payrollAccess({ role: 'admin', permissions: ['payslip:create'] }).canProcess, false)
assert.equal(payrollAccess({ role: 'admin', permissions: ['payrun:update', 'payslip:create'] }).canProcess, true)
assert.equal(payrollAccess({ role: 'admin', permissions: ['payrun:update', 'payslip:create'] }).canSend, false)

// Configuring one resource must not expose actions on another resource.
for (const [code, enabled] of [
  ['payrun:read', 'canReadPayruns'],
  ['payslip:read', 'canReadPayslips'],
  ['salary_rule:read', 'canReadRules'],
  ['salary_structure:read', 'canReadStructures'],
  ['payrun:create', 'canCreatePayrun'],
  ['salary_rule:create', 'canCreateRules'],
  ['salary_structure:create', 'canCreateStructures'],
  ['salary_rule:update', 'canConfigureRules'],
  ['salary_structure:update', 'canConfigureStructures'],
  ['payrun:delete', 'canDeletePayrun'],
  ['payslip:delete', 'canDeletePayslip'],
  ['salary_rule:delete', 'canDeleteRules'],
  ['salary_structure:delete', 'canDeleteStructures'],
  ['payslip:send', 'canSend'],
]) {
  const access = payrollAccess({ role: 'admin', permissions: [code] })
  assert.equal(access[enabled], true, `${code}: intended action visible`)
  for (const flag of ['canReadPayruns', 'canReadPayslips', 'canReadRules', 'canReadStructures', 'canCreatePayrun', 'canCreateRules', 'canCreateStructures', 'canConfigureRules', 'canConfigureStructures', 'canDeletePayrun', 'canDeletePayslip', 'canDeleteRules', 'canDeleteStructures', 'canSend']) {
    if (flag !== enabled) assert.equal(access[flag], false, `${code}: unrelated ${flag} stays hidden`)
  }
}
const readOwnLeave = timeOffAccess({ role: 'admin', permissions: ['time_off:read:own'] })
assert.equal(readOwnLeave.canReadOwn, true)
assert.equal(readOwnLeave.canReadTypes, false)
assert.equal(readOwnLeave.canReadAllocations, false)
assert.equal(timeOffAccess({ role: 'admin', permissions: ['time_off:update:any'] }).canDeleteTypes, false)
assert.equal(timeOffAccess({ role: 'admin', permissions: ['time_off:delete'] }).canCreateTypes, false)

const { parseSessionUser } = load('features/auth/auth-validation.ts')
const account = { id: 'user-1', email: 'role-test@example.com', role: 'hr_payroll_user' }
assert.deepEqual(parseSessionUser({ ...account, permissions: [] })?.permissions, [], 'An empty grant array must survive session parsing')
assert.deepEqual(parseSessionUser({ ...account, permissions: ['payslip:read'] })?.permissions, ['payslip:read'], 'Current server grants must survive session parsing')
assert.equal(parseSessionUser(account)?.permissions, undefined, 'Legacy role-only sessions keep the role fallback')

console.log('PASS: five-role UI matrix, read-only payroll configuration, live grant overrides, explicit revocations, and session permission preservation.')
