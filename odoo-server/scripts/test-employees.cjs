const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// No real DB, Redis, HTTP requests, image uploads, or employee records are used.
const modules = new Map()
const routes = []
const queries = []
const middleware = []
const serviceCacheKeys = []
let currentAccount = { id: '12345678-1234-4234-8234-123456789012', name: 'Current fixture', email: 'current@example.invalid', role: 'employee', status: 'active' }
const cachedValues = new Map()
const redis = {
  async get(key) { return cachedValues.get(key) ?? null },
  async set(key, value) { cachedValues.set(key, value) },
  async incr(key) {
    const next = Number(cachedValues.get(key) ?? 0) + 1
    cachedValues.set(key, String(next))
    return next
  }
}
const summary = { total: 12, active: 10, departments: 4, locations: 2, withManager: 9, withoutManager: 3 }
const profile = { userId: '12345678-1234-4234-8234-123456789012', name: 'Fixture only', email: 'fixture@example.invalid', role: 'employee', status: 'active', jobPosition: 'Engineer', contact: '12345678', department: 'Engineering', managerId: null, managerName: null, workingSchedule: 'Weekdays', company: 'Fixture', workLocation: 'Office', location: null, createdAt: new Date(), updatedAt: new Date() }
const router = { use(handler) { middleware.push(handler) }, get(...args) { routes.push(['GET', ...args]) }, post(...args) { routes.push(['POST', ...args]) }, patch(...args) { routes.push(['PATCH', ...args]) }, delete(...args) { routes.push(['DELETE', ...args]) } }
const controllers = Object.fromEntries(['createEmployeeProfileHandler', 'deleteEmployeeImageHandler', 'deleteEmployeeProfileHandler', 'getEmployeeProfileHandler', 'listEmployeesHandler', 'listEmployeeAccountsHandler', 'listManagersHandler', 'updateEmployeeProfileHandler', 'uploadEmployeeImagesHandler'].map(name => [name, function handler() {}]))
const pool = { async connect() { return { query: (sql, values) => pool.query(sql, values), release() {} } }, async query(sql, values) {
  queries.push({ sql, values })
  if (sql.includes('FOR UPDATE')) return { rows: [{ employee_image_public_id: null, company_image_public_id: null }] }
  if (sql.includes('COUNT(DISTINCT')) return { rows: [summary] }
  if (sql.includes('COUNT(*)::int AS total')) return { rows: [{ total: 7 }] }
  if (sql.includes('NOT EXISTS')) return { rows: [{ id: profile.userId, name: profile.name, email: profile.email, role: profile.role, status: 'active' }] }
  if (sql.includes('LIMIT')) return { rows: [] }
  return { rows: [profile] }
} }
const mocks = {
  './redis': { redis },
  './logger': { logger: { info() {}, warn() {} } },
  '../config/env': { env: { cacheTtlSeconds: 60 } },
  express: { Router: () => router },
  '../controllers/employee.controller': controllers,
  '../middlewares/auth.middleware': { requireAuth() {} },
  '../repositories/user.repository': { findUserById: async () => currentAccount },
  '../middlewares/permission.middleware': { requirePermission: code => code, requireScopedPermission: code => code },
  '../middlewares/upload.middleware': { uploadEmployeeImages() {} },
  '../lib/db': { pool },
  '../lib/cache': { bumpCacheVersion: async () => {}, getCacheVersion: async () => 1, getCached: async () => null, invalidateCache: async () => {}, setCached: async key => { serviceCacheKeys.push(key) } },
  '../lib/cloudinary': { uploadImageToCloudinary: async () => { throw new Error('Image upload is out of scope') } },
  '../queues/deleteCloudinaryImage.queue': { enqueueCloudinaryImageDeletion: async () => {} }
}
function load(relative) {
  let file = path.resolve(__dirname, '../src', relative)
  if (!file.endsWith('.ts')) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const module = { exports: {} }
  modules.set(file, module)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name))
    return require(name)
  }
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports)
  return module.exports
}
async function main() {
  const schemas = load('types/employee.dto')
  assert.equal(schemas.updateEmployeeProfileSchema.safeParse({ managerId: null, location: null }).success, true)
  assert.equal(schemas.updateEmployeeProfileSchema.safeParse({}).success, false)
  assert.equal(schemas.updateEmployeeProfileSchema.safeParse({ managerId: 'invalid' }).success, false)
  assert.equal(schemas.updateEmployeeProfileSchema.safeParse({ contact: 'bad contact' }).success, false)
  assert.equal(schemas.listEmployeesQuerySchema.safeParse({ limit: 101 }).success, false)
  load('routes/employee.routes')
  const { requireCurrentEmployeeAccount } = load('middlewares/employee-account.middleware')
  assert.deepEqual(middleware, [mocks['../middlewares/auth.middleware'].requireAuth, requireCurrentEmployeeAccount])
  const staleRequest = { user: { userId: profile.userId, email: 'stale@example.invalid', role: 'admin' } }
  let advanced = false
  await requireCurrentEmployeeAccount(staleRequest, {}, () => { advanced = true })
  assert.equal(advanced, true)
  assert.deepEqual(staleRequest.user, { userId: profile.userId, email: currentAccount.email, role: 'employee' }, 'permissions must receive current role rather than stale admin claim')
  await assert.rejects(requireCurrentEmployeeAccount({}, {}, () => assert.fail('unauthenticated request advanced')), error => error.statusCode === 401)
  currentAccount.status = 'inactive'
  await assert.rejects(requireCurrentEmployeeAccount(staleRequest, {}, () => assert.fail('inactive account advanced')), error => error.statusCode === 403)
  currentAccount = null
  await assert.rejects(requireCurrentEmployeeAccount(staleRequest, {}, () => assert.fail('deleted account advanced')), error => error.statusCode === 401)
  const deletion = routes.find(route => route[0] === 'DELETE' && route[1] === '/:userId')
  assert.deepEqual(deletion.slice(2), ['employee:delete', controllers.deleteEmployeeProfileHandler], 'profile delete must not call the image-only handler')
  const accountRoute = routes.find(route => route[0] === 'GET' && route[1] === '/accounts')
  assert.deepEqual(accountRoute.slice(2), ['employee:create', 'employee:read:any', controllers.listEmployeeAccountsHandler])
  assert.ok(routes.indexOf(accountRoute) < routes.findIndex(route => route[0] === 'GET' && route[1] === '/:userId'))

  const repository = load('repositories/employee.repository')
  const result = await repository.findAllProfiles({ limit: 10, offset: 100, department: 'People', search: 'Alex', role: 'employee' })
  assert.equal(result.total, 7, 'total must survive an empty page beyond the last row')
  assert.deepEqual(result.rows, [])
  assert.deepEqual(result.summary, summary, 'KPI counts must come from the full directory, not the current page')
  const pageQuery = queries.find(query => query.sql.includes('LIMIT'))
  assert.deepEqual(pageQuery.values, ['%People%', 'employee', '%Alex%', 10, 100])
  assert.match(pageQuery.sql, /ORDER BY u.name, p.user_id/)
  const summaryQuery = queries.find(query => query.sql.includes('COUNT(DISTINCT'))
  assert.equal(summaryQuery.values, undefined, 'summary must not apply directory filters')
  const accounts = await repository.findEligibleEmployeeAccounts()
  assert.equal(accounts.length, 1)
  assert.match(queries.at(-1).sql, /u.status = 'active'/)
  assert.match(queries.at(-1).sql, /NOT EXISTS/)
  assert.doesNotMatch(queries.at(-1).sql, /password/)
  await repository.findManagerRole(profile.userId)
  assert.match(queries.at(-1).sql, /u.status = 'active'/)
  const updated = await repository.updateProfile(profile.userId, { managerId: null, location: null }, null, null)
  assert.equal(updated.profile.managerId, null)
  assert.equal(updated.profile.location, null)
  const updateQuery = queries.find(query => query.sql.includes('UPDATE employee_profiles'))
  assert.match(updateQuery.sql, /manager_id = \$1/)
  assert.match(updateQuery.sql, /location = \$2/)
  assert.deepEqual(updateQuery.values, [null, null, profile.userId], 'clearing optional fields must bind SQL NULL, not omit assignments')

  const service = load('services/employee.service')
  const directory = await service.listEmployeeProfiles({ limit: 10, offset: 100 })
  assert.deepEqual(directory.summary, summary)
  assert.deepEqual(directory.pagination, { total: 7, limit: 10, offset: 100, hasMore: false })
  await service.listEmployeeProfiles({ limit: 10, offset: 0, department: 'D&role=employee&search=', search: 'S' })
  await service.listEmployeeProfiles({ limit: 10, offset: 0, department: 'D', role: 'employee', search: '&role=&search=S' })
  assert.notEqual(serviceCacheKeys.at(-1), serviceCacheKeys.at(-2), 'filter separators inside values must not collide with cache key fields')
  const cache = load('lib/cache')
  const initialVersion = await cache.getCacheVersion('employee-list')
  assert.equal(initialVersion, 0)
  await cache.setCached(`employee-list:v${initialVersion}`, { employees: [] })
  await cache.bumpCacheVersion('employee-list')
  const updatedVersion = await cache.getCacheVersion('employee-list')
  assert.equal(updatedVersion, 1)
  assert.notEqual(updatedVersion, initialVersion, 'the first mutation must invalidate the initial empty directory')
  assert.equal(await cache.getCached(`employee-list:v${updatedVersion}`), null)
  console.log('PASS: Employee delete routing, current account permissions, nullable clearing, eligible accounts, active managers, stable pagination, full-directory KPI summaries, collision-free keys, and first-write cache invalidation.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
