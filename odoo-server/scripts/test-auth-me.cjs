const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Dependency-level tests only. No server, database, Redis, or real JWT secret.
let account = null
let queriedId = null
const registrations = []
const modules = new Map()
const mocks = {
  '../repositories/user.repository': { findUserById: async id => { queriedId = id; return account } },
  '../lib/jwt': { verifyAccessToken: token => { if (token !== 'valid-test-token') { const error = new Error('Invalid or expired access token'); error.statusCode = 401; throw error } return { userId: 'test-id', email: 'stale@example.com', role: 'employee' } } },
  '../lib/validate': { parseOrThrow: () => { throw new Error('Not in scope') } },
  '../types/user.dto': {},
  '../services/auth.service': {},
  express: { Router: () => ({ get: (...args) => registrations.push(args), post: () => {} }) }
}
function load(relative) {
  let file = path.resolve(__dirname, '../src', relative)
  if (!file.endsWith('.ts')) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const module = { exports: {} }
  modules.set(file, module)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
  const localRequire = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name)
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports)
  return module.exports
}
async function main() {
  const { getCurrentAuthUser } = load('services/current-auth-user.service')
  await assert.rejects(getCurrentAuthUser('test-id'), error => error.statusCode === 401)
  account = { id: 'test-id', email: 'current@example.com', role: 'hr_manager', name: 'Current name', status: 'inactive', password_hash: 'must-not-leak' }
  await assert.rejects(getCurrentAuthUser('test-id'), error => error.statusCode === 403)
  account.status = 'active'
  const expected = { id: 'test-id', email: 'current@example.com', role: 'hr_manager', name: 'Current name' }
  assert.deepEqual(await getCurrentAuthUser('test-id'), expected)
  assert.equal(queriedId, 'test-id')
  const { requireAuth } = load('middlewares/auth.middleware')
  for (const authorization of [undefined, '', 'Basic invalid', 'Bearer ', 'Bearer expired-test-token']) {
    assert.throws(() => requireAuth({ headers: { authorization } }, {}, () => { throw new Error('Must not call next') }), error => error.statusCode === 401)
  }
  load('routes/auth.routes')
  const route = registrations.find(entry => entry[0] === '/me')
  assert.equal(route.length, 3)
  assert.equal(route[1], requireAuth)
  const request = { headers: { authorization: 'Bearer valid-test-token' } }
  let authenticated = false
  requireAuth(request, {}, () => { authenticated = true })
  assert.equal(authenticated, true)
  const response = { statusCode: null, payload: null, headers: {}, setHeader(name, value) { this.headers[name] = value; return this }, status(code) { this.statusCode = code; return this }, json(payload) { this.payload = payload; return this } }
  await route[2](request, response)
  assert.equal(response.statusCode, 200)
  assert.equal(response.headers['Cache-Control'], 'no-store, private')
  assert.deepEqual(response.payload, { success: true, data: { user: expected } })
  assert.equal(JSON.stringify(response.payload).includes('must-not-leak'), false)
  await assert.rejects(route[2]({ headers: {} }, response), error => error.statusCode === 401)
  account = null
  await assert.rejects(route[2](request, response), error => error.statusCode === 401)
  console.log('Auth /me: current account, status, deleted account, private-field exclusion, middleware, and controller checks passed.')
}
main().catch(error => { console.error(error); process.exitCode = 1 })
