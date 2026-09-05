const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Isolated database/HTTP fixtures only. Never changes a live account or permission.
const catalog = ['employee:read:own', 'employee:read:any', 'employee:create', 'time_off:approve', 'role:read']
let grants = { employee: ['employee:read:own'], hr_manager: ['employee:create', 'employee:read:any'] }
let backup
let released = 0
const clone = value => JSON.parse(JSON.stringify(value))
const client = {
  async query(sql, values = []) {
    if (sql === 'BEGIN') { backup = clone(grants); return { rows: [] } }
    if (sql === 'COMMIT') { backup = null; return { rows: [] } }
    if (sql === 'ROLLBACK') { grants = backup; return { rows: [] } }
    if (sql.includes('FROM roles WHERE')) return { rows: values[0].filter(name => grants[name]).map(name => ({ id: name, name })) }
    if (sql === 'SELECT id, code FROM permissions') return { rows: catalog.map(code => ({ id: code, code })) }
    if (sql.startsWith('SELECT p.code FROM role_permissions')) return { rows: [...grants[values[0]]].sort().map(code => ({ code })) }
    if (sql.startsWith('DELETE FROM role_permissions')) { grants[values[0]] = []; return { rows: [] } }
    if (sql.startsWith('INSERT INTO role_permissions')) { grants[values[0]] = [...values[1]]; return { rows: [] } }
    throw new Error('Unexpected SQL: ' + sql)
  },
  release() { released += 1 },
}
const pool = {
  connect: async () => client,
  async query(sql) {
    if (sql.startsWith('SELECT code, description')) return { rows: catalog.map(code => ({ code, description: code })) }
    if (sql.startsWith('SELECT r.id')) return { rows: Object.entries(grants).map(([name, permissions]) => ({ id: name, name, permissions })) }
    throw new Error('Unexpected pool SQL: ' + sql)
  },
}
let account = { id: 'self', email: 'self@example.invalid', role: 'hr_manager' }
const mocks = {
  '../lib/db': { pool },
  '../services/current-auth-user.service': { getCurrentAuthUser: async () => account },
  '../services/permission.service': { getRolePermissions: async role => new Set(grants[role]) },
  '../lib/validate': { parseOrThrow: (_schema, input) => input },
  '../types/time-off.dto': {},
  '../services/time-off.service': {
    listTypes: async () => [{ id: 'active-type', active: true }, { id: 'archived-own-type', active: false }, { id: 'unrelated-type', active: false }],
    listMyAllocations: async id => [{ id: 'own-allocation', employeeId: id, typeId: 'archived-own-type' }],
    listMyRequests: async id => [{ id: 'own-request', employeeId: id, typeId: 'active-type' }],
    createRequest: async (input, actor) => { assert.equal(input.employeeId, actor.userId); assert.equal(actor.role, 'employee'); return { id: 'test-only-request', ...input } },
  },
}
const modules = new Map()
function load(relative) {
  let file = path.resolve(__dirname, '../src', relative)
  if (!file.endsWith('.ts')) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const module = { exports: {} }; modules.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const localRequire = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name)
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}
async function main() {
  const { parseRoleChanges, saveRoleChanges } = load('services/role-management.service')
  const change = (role, permissions, expectedPermissions = grants[role]) => ({ role, permissions, expectedPermissions })
  for (const input of [null, {}, { changes: [] }, { changes: [change('admin', [])] }, { changes: [change('hr_manager', ['role:read'])] }, { changes: [change('hr_manager', ['employee:create', 'employee:create'])] }]) assert.throws(() => parseRoleChanges(input), error => error.statusCode === 400)
  await saveRoleChanges([change('hr_manager', ['employee:read:any'])])
  assert.deepEqual(grants.hr_manager, ['employee:read:any'])
  await saveRoleChanges([change('hr_manager', ['employee:read:any'], ['stale:permission'])]) // safe retry of confirmed desired state
  const before = clone(grants)
  await assert.rejects(saveRoleChanges([change('hr_manager', ['employee:create'], []), change('employee', [])]), error => error.statusCode === 409)
  assert.deepEqual(grants, before)
  await assert.rejects(saveRoleChanges([change('employee', []), change('hr_manager', ['employee:create'], [])]), error => error.statusCode === 409)
  assert.deepEqual(grants, before, 'Conflicts roll back every role in the batch')
  await assert.rejects(saveRoleChanges([change('employee', ['unknown:permission'])]), error => error.statusCode === 400)
  assert.ok(released >= 5)
  const { requirePermission, requireScopedPermission } = load('middlewares/permission.middleware')
  const req = { user: { userId: 'self', role: 'admin' }, params: { userId: 'self' } }
  let passed = false
  await requirePermission('employee:read:any')(req, {}, () => { passed = true })
  assert.equal(passed, true); assert.equal(req.user.role, 'hr_manager', 'Ignore stale token role')
  grants.hr_manager = []
  await assert.rejects(requirePermission('employee:read:any')(req, {}, () => assert.fail('revoked access')), error => error.statusCode === 403)
  account = { ...account, role: 'employee' }
  await requireScopedPermission('employee:read')(req, {}, () => {})
  req.params.userId = 'another'
  await assert.rejects(requireScopedPermission('employee:read')(req, {}, () => assert.fail('another employee')), error => error.statusCode === 403)
  const { getMyTimeOffHandler, createMyRequestHandler } = load('controllers/time-off.controller')
  let payload
  const res = { setHeader() {}, status() { return this }, json(value) { payload = value } }
  await getMyTimeOffHandler(req, res)
  assert.ok(payload.data.allocations.every(record => record.employeeId === 'self'))
  assert.deepEqual(payload.data.types.map(type => type.id), ['active-type', 'archived-own-type'])
  req.body = { employeeId: 'another' }
  await assert.rejects(createMyRequestHandler(req, res), error => error.statusCode === 403)
  req.body = { reason: 'Test-only request' }
  await createMyRequestHandler(req, res)
  assert.equal(payload.data.employeeId, 'self')
  console.log('PASS: role validation, atomic grant/revoke saves, conflicts/rollback, retry safety, fresh permission enforcement, own-record checks and self-service leave scoping.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
