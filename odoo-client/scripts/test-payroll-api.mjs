import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { NextResponse } from 'next/server.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const modules = new Map()
const payrunId = '22222222-2222-4222-8222-222222222222'
const employeeId = '11111111-1111-4111-8111-111111111111'
const structureId = '33333333-3333-4333-8333-333333333333'
const ruleId = '44444444-4444-4444-8444-444444444444'
const origin = 'https://peoplepay.example'
let sessionToken = 'isolated-session-token'
let user = { id: employeeId, role: 'admin' }
let authUnavailable = false
let status = 200
let payload = {
  success: true,
  data: { payruns: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } }
}
const calls = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  calls.push({ url, options })
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

const json = (body, code = 200) => NextResponse.json(body, {
  status: code,
  headers: { 'Cache-Control': 'no-store, private' }
})
const mocks = {
  'server-only': {},
  'next/headers': {
    cookies: async () => ({
      get: () => sessionToken ? { value: sessionToken } : undefined
    })
  },
  '@/features/auth/auth-server': {
    authJson: json,
    authError: (message, code) => json({ success: false, message }, code),
    checkSameOrigin: request => {
      if (
        request.headers.get('origin') !== new URL(request.url).origin ||
        request.headers.get('sec-fetch-site') === 'cross-site'
      ) {
        return json({ success: false }, 403)
      }
      return null
    },
    readVerifiedUser: async () => {
      if (authUnavailable) throw new Error('Unavailable test dependency')
      return user
    }
  }
}

function load(relative) {
  let file = path.resolve(root, relative)
  if (!existsSync(file)) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const loaded = { exports: {} }
  modules.set(file, loaded)
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.startsWith('@/')) return load(name.slice(2))
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name))
    return requirePackage(name)
  }
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const payruns = load('app/api/payroll/payruns/route.ts')
const payrun = load('app/api/payroll/payruns/[id]/route.ts')
const compute = load('app/api/payroll/payruns/[id]/compute/route.ts')
const validate = load('app/api/payroll/payruns/[id]/validate/route.ts')
const markPaid = load('app/api/payroll/payruns/[id]/mark-paid/route.ts')
const rules = load('app/api/payroll/salary-rules/route.ts')
const rule = load('app/api/payroll/salary-rules/[id]/route.ts')
const structures = load('app/api/payroll/salary-structures/route.ts')
const payslips = load('app/api/payroll/payslips/route.ts')
const eligible = load('app/api/payroll/eligible-employees/route.ts')
const bankAccount = load('app/api/payroll/bank-accounts/[employeeId]/route.ts')
const dashboard = load('app/api/payroll/dashboard/route.ts')

const runContext = { params: Promise.resolve({ id: payrunId }) }
const ruleContext = { params: Promise.resolve({ id: ruleId }) }
const employeeContext = { params: Promise.resolve({ employeeId }) }

function request(method = 'GET', suffix = '', body, headers = {}) {
  const options = { method, headers: { Origin: origin, ...headers } }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
    options.headers['Content-Type'] = 'application/json'
  }
  return new Request(origin + '/api/payroll' + suffix, options)
}

const payrunInput = {
  name: 'August 2026',
  structureId,
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  employeeIds: [employeeId]
}
const ruleInput = {
  name: 'House Rent Allowance',
  code: 'HRA',
  category: 'allowance',
  sequence: 10,
  method: 'percentage',
  percentage: 40,
  base: 'BASIC',
  quantity: 1
}

try {
  sessionToken = ''
  assert.equal((await payruns.GET(request())).status, 401)
  assert.equal(calls.length, 0)
  sessionToken = 'isolated-session-token'
  user = null
  assert.equal((await payruns.GET(request())).status, 401)
  user = { id: employeeId, role: 'admin' }
  authUnavailable = true
  assert.equal((await payruns.GET(request())).status, 503)
  authUnavailable = false

  const response = await payruns.GET(request(
    'GET',
    `/payruns?limit=10&offset=20&status=validated&structureId=${structureId}&search=August`
  ))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal((await response.text()).includes(sessionToken), false)
  const forwarded = calls.at(-1)
  assert.match(forwarded.url, /\/payroll\/payruns\?limit=10&offset=20&status=validated&structureId=.*&search=August$/)
  assert.equal(forwarded.options.headers.get('authorization'), `Bearer ${sessionToken}`)
  assert.equal(forwarded.options.cache, 'no-store')
  assert.equal(forwarded.options.redirect, 'error')

  for (const query of [
    '/payruns?limit=0',
    '/payruns?limit=101',
    '/payruns?offset=-1',
    '/payruns?status=archived',
    '/payruns?structureId=bad',
    '/payruns?search=',
    '/payruns?page=2',
    '/payruns?limit=1&limit=2'
  ]) {
    assert.equal((await payruns.GET(request('GET', query))).status, 400, query)
  }
  for (const query of ['/payslips?status=archived', '/payslips?payrunId=bad', '/salary-rules?category=bonus', '/eligible-employees?startDate=bad']) {
    const route = query.startsWith('/payslips') ? payslips : query.startsWith('/salary-rules') ? rules : eligible
    assert.equal((await route.GET(request('GET', query))).status, 400, query)
  }
  assert.equal((await eligible.GET(request('GET', '/eligible-employees?startDate=2026-08-01&endDate=2026-08-31'))).status, 200)
  assert.match(calls.at(-1).url, /\/payroll\/eligible-employees\?startDate=2026-08-01&endDate=2026-08-31$/)

  assert.equal((await dashboard.GET(request(
    'GET',
    '/dashboard?startDate=2026-08-01&endDate=2026-08-31&department=Finance&jobPosition=Analyst&currency=INR'
  ))).status, 200)
  assert.match(calls.at(-1).url, /\/payroll\/dashboard\?startDate=2026-08-01&endDate=2026-08-31&department=Finance&jobPosition=Analyst&currency=INR$/)
  for (const query of [
    '/dashboard?startDate=bad&endDate=2026-08-31',
    '/dashboard?startDate=2026-08-01&endDate=2026-08-31&currency=RUPEE',
    '/dashboard?startDate=2026-08-01&endDate=2026-08-31&currency=1',
    '/dashboard?startDate=2026-08-01&endDate=2026-08-31&limit=10',
    '/dashboard?startDate=2026-08-01&endDate=2026-08-31&department='
  ]) {
    assert.equal((await dashboard.GET(request('GET', query))).status, 400, query)
  }

  await payrun.GET(request(), runContext)
  assert.match(calls.at(-1).url, new RegExp(`/payroll/payruns/${payrunId}$`))
  assert.equal((await payrun.GET(request(), {
    params: Promise.resolve({ id: '../../auth/me' })
  })).status, 400)

  status = 201
  payload = { success: true, data: { id: payrunId } }
  assert.equal((await payruns.POST(request('POST', '/payruns', payrunInput))).status, 201)
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), payrunInput)
  assert.equal((await rules.POST(request('POST', '/salary-rules', ruleInput))).status, 201)
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), ruleInput)
  assert.equal((await structures.POST(request('POST', '/salary-structures', {
    name: 'Regular Salary',
    ruleIds: [ruleId],
    ruleSequences: [{ id: ruleId, sequence: 10 }]
  }))).status, 201)

  status = 200
  for (const [route, action] of [[compute, 'compute'], [validate, 'validate'], [markPaid, 'mark-paid']]) {
    assert.equal((await route.POST(request('POST', `/payruns/${payrunId}/${action}`), runContext)).status, 200)
    assert.match(calls.at(-1).url, new RegExp(`/payroll/payruns/${payrunId}/${action}$`))
    assert.equal(calls.at(-1).options.body, undefined, 'a lifecycle action carries no body')
  }
  assert.equal((await bankAccount.PUT(request('PUT', `/bank-accounts/${employeeId}`, {
    accountNumber: 'IN90123456780001'
  }), employeeContext)).status, 200)

  for (const body of [
    {},
    { name: 'August 2026' },
    { ...payrunInput, unsupported: true },
    { ...payrunInput, employeeIds: [] },
    { ...payrunInput, employeeIds: ['not-a-uuid'] },
    { ...payrunInput, startDate: 'not-a-date' },
    { ...payrunInput, name: '' }
  ]) {
    assert.equal((await payrun.PATCH(request('PATCH', '', body), runContext)).status, 400, JSON.stringify(body))
  }
  for (const body of [
    { code: 'lowercase' },
    { code: '1LEADING' },
    { category: 'bonus' },
    { method: 'sql' },
    { sequence: -1 },
    { sequence: 1.5 },
    { percentage: 1001 },
    { quantity: -1 },
    { quantity: 10001 },
    { quantity: 'two' },
    { active: 'yes' },
    {}
  ]) {
    assert.equal((await rule.PATCH(request('PATCH', '', body), ruleContext)).status, 400, JSON.stringify(body))
  }
  assert.equal((await rules.POST(request('POST', '/salary-rules', { name: 'Only a name' }))).status, 400)
  assert.equal((await payruns.POST(request('POST', '/payruns'))).status, 415)
  assert.equal((await payruns.POST(new Request(origin + '/api/payroll/payruns', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{'
  }))).status, 400)
  assert.equal((await rule.PATCH(request('PATCH', '', {
    formula: 'x'.repeat(100_000)
  }), ruleContext)).status, 413)

  for (const headers of [
    { Origin: 'https://foreign.example' },
    { 'sec-fetch-site': 'cross-site' }
  ]) {
    assert.equal((await payrun.DELETE(request('DELETE', '', undefined, headers), runContext)).status, 403)
    assert.equal((await compute.POST(request('POST', '', undefined, headers), runContext)).status, 403)
  }
  assert.equal((await payrun.DELETE(new Request(origin + '/api/payroll/payruns', {
    method: 'DELETE'
  }), runContext)).status, 403)

  for (const expected of [400, 401, 403, 404, 409, 413, 415, 422, 429]) {
    status = expected
    payload = { success: false, message: 'Known public payroll error' }
    assert.equal((await payruns.GET(request())).status, expected)
  }
  status = 500
  payload = { message: 'Private database internals' }
  const failure = await payruns.GET(request())
  assert.equal(failure.status, 502)
  assert.equal((await failure.text()).includes('Private database'), false)
  status = 200
  payload = { invalid: true }
  assert.equal((await payruns.GET(request())).status, 502)

  console.log('PASS: Payroll API authentication, query/body/path validation, origin protection, lifecycle forwarding, backend status mapping and cookie privacy.')
} finally {
  globalThis.fetch = originalFetch
}
