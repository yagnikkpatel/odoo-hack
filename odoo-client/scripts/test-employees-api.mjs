import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { NextResponse } from 'next/server.js'

// Isolated route tests: no real credentials, servers, uploads, or business records.
const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const modules = new Map()
const accountId = '12345678-1234-4234-8234-123456789012'
const origin = 'https://peoplepay.example'
let sessionToken = 'isolated-session-token'
let user = { id: accountId, role: 'admin' }
let authUnavailable = false
let status = 200
let payload = { success: true, data: { employees: [], pagination: { total: 0 } } }
const calls = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  calls.push({ url, options })
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}
const json = (body, code = 200) => NextResponse.json(body, { status: code, headers: { 'Cache-Control': 'no-store, private' } })
const mocks = {
  'server-only': {},
  'next/headers': { cookies: async () => ({ get: () => sessionToken ? { value: sessionToken } : undefined }) },
  '@/features/auth/auth-server': {
    authJson: json,
    authError: (message, code) => json({ success: false, message }, code),
    checkSameOrigin: request => {
      if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') {
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
const list = load('app/api/employees/route.ts')
const profile = load('app/api/employees/[userId]/route.ts')
const accounts = load('app/api/employees/accounts/route.ts')
const managers = load('app/api/employees/managers/route.ts')
const images = load('app/api/employees/[userId]/images/route.ts')
const imageDelete = load('app/api/employees/[userId]/images/[imageType]/route.ts')
const context = { params: Promise.resolve({ userId: accountId }) }
function request(method = 'GET', suffix = '', body, headers = {}) {
  const options = { method, headers: { Origin: origin, ...headers } }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
    options.headers['Content-Type'] = 'application/json'
  }
  return new Request(origin + '/api/employees' + suffix, options)
}
const validProfile = {
  jobPosition: 'Engineer', department: 'Engineering', contact: '+91 12345678',
  workingSchedule: 'Weekdays', companyName: 'Test company', workLocation: 'Office',
  managerId: accountId, location: 'Test city'
}
try {
  sessionToken = ''
  assert.equal((await list.GET(request())).status, 401)
  assert.equal(calls.length, 0)
  sessionToken = 'isolated-session-token'
  user = null
  assert.equal((await list.GET(request())).status, 401)
  user = { id: accountId, role: 'admin' }
  authUnavailable = true
  assert.equal((await list.GET(request())).status, 503)
  authUnavailable = false

  const response = await list.GET(request('GET', '?limit=10&offset=20&department=People%20Ops&role=employee&search=Jo'))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal((await response.text()).includes(sessionToken), false)
  const forwarded = calls.at(-1)
  assert.match(forwarded.url, /\/employees\?limit=10&offset=20&department=People\+Ops&role=employee&search=Jo$/)
  assert.equal(forwarded.options.headers.get('authorization'), `Bearer ${sessionToken}`)
  assert.equal(forwarded.options.cache, 'no-store')
  assert.equal(forwarded.options.redirect, 'error')
  for (const query of ['?limit=0', '?limit=101', '?limit=no', '?offset=-1', '?offset=2147483648', '?search=', '?role=owner', '?page=2', '?limit=1&limit=2']) {
    assert.equal((await list.GET(request('GET', query))).status, 400, query)
  }
  await accounts.GET(request())
  assert.match(calls.at(-1).url, /\/employees\/accounts$/)
  await managers.GET(request())
  assert.match(calls.at(-1).url, /\/employees\/managers$/)
  await profile.GET(request(), context)
  assert.match(calls.at(-1).url, new RegExp('/employees/' + accountId + '$'))
  assert.equal((await profile.GET(request(), { params: Promise.resolve({ userId: '../auth/me' }) })).status, 400)
  assert.equal((await profile.POST(request('POST', '', validProfile), context)).status, 200)
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), validProfile)
  assert.equal((await profile.PATCH(request('PATCH', '', { managerId: null, location: null }), context)).status, 400)
  for (const location of [
    { workLatitude: 23.022505, workLongitude: 72.5713621, workRadiusM: 200 },
    { workLatitude: 0, workLongitude: 0, workRadiusM: 10 },
    { workLatitude: null, workLongitude: null },
    { workRadiusM: 5000 },
  ]) {
    assert.equal((await profile.PATCH(request('PATCH', '', location), context)).status, 200)
    assert.deepEqual(JSON.parse(calls.at(-1).options.body), location)
  }
  for (const location of [
    { workLatitude: 91, workLongitude: 0 }, { workLatitude: 0, workLongitude: -181 },
    { workLatitude: 0 }, { workLatitude: null, workLongitude: 0 },
    { workLatitude: '23', workLongitude: 72 }, { workRadiusM: 0 },
    { workRadiusM: 5001 }, { workRadiusM: 10.5 }, { workRadiusM: null },
  ]) {
    const before = calls.length
    assert.equal((await profile.PATCH(request('PATCH', '', location), context)).status, 400)
    assert.equal(calls.length, before, 'Invalid office coordinates must not reach the backend')
  }
  for (const body of [{}, { name: 'Not a profile field' }, { contact: 'invalid phone' }, { managerId: 'bad' }, { department: '' }, { location: 1 }]) {
    assert.equal((await profile.PATCH(request('PATCH', '', body), context)).status, 400)
  }
  assert.equal((await profile.POST(request('POST', '', { department: 'HR' }), context)).status, 400)
  assert.equal((await profile.POST(request('POST'), context)).status, 415)
  assert.equal((await profile.POST(new Request(origin + '/api/employees', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' }), context)).status, 400)
  assert.equal((await profile.PATCH(request('PATCH', '', { department: 'x'.repeat(20_000) }), context)).status, 413)
  assert.equal((await profile.DELETE(request('DELETE', '', undefined, { Origin: 'https://foreign.example' }), context)).status, 403)
  assert.equal((await profile.DELETE(new Request(origin + '/api/employees', { method: 'DELETE' }), context)).status, 403)
  assert.equal((await profile.DELETE(request('DELETE', '', undefined, { 'sec-fetch-site': 'cross-site' }), context)).status, 403)
  assert.equal((await profile.DELETE(request('DELETE'), context)).status, 200)

  for (const expected of [400, 401, 403, 404, 409, 413, 415, 422, 429]) {
    status = expected
    payload = { success: false, message: 'Known public employee error' }
    assert.equal((await list.GET(request())).status, expected)
  }
  status = 500
  payload = { message: 'Private database internals' }
  const failure = await list.GET(request())
  assert.equal(failure.status, 502)
  assert.equal((await failure.text()).includes('Private database'), false)
  status = 200
  payload = { invalid: true }
  assert.equal((await list.GET(request())).status, 502)
  payload = { success: true, data: {} }

  const upload = new FormData()
  upload.append('employeeImage', new File([new Uint8Array([137, 80, 78, 71])], 'photo.png', { type: 'image/png' }))
  assert.equal((await images.POST(new Request(origin + '/api/employees/images', { method: 'POST', headers: { Origin: origin }, body: upload }), context)).status, 200)
  assert.equal(calls.at(-1).options.headers.has('content-type'), false, 'fetch must generate multipart boundary')
  assert.equal(calls.at(-1).options.body.get('employeeImage').name, 'photo.png')
  const wrongUpload = new FormData()
  wrongUpload.append('employeeImage', 'not a file')
  assert.equal((await images.POST(new Request(origin + '/api/employees/images', { method: 'POST', headers: { Origin: origin }, body: wrongUpload }), context)).status, 400)
  for (const [type, size] of [['image/svg+xml', 10], ['image/png', 5 * 1024 * 1024 + 1]]) {
    const rejectedUpload = new FormData()
    rejectedUpload.append('employeeImage', new File([new Uint8Array(size)], 'upload.png', { type }))
    assert.equal((await images.POST(new Request(origin + '/api/employees/images', { method: 'POST', headers: { Origin: origin }, body: rejectedUpload }), context)).status, 400)
  }
  assert.equal((await images.POST(new Request(origin + '/api/employees/images', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'multipart/form-data; boundary=test', 'Content-Length': String(12 * 1024 * 1024) }, body: 'test'
  }), context)).status, 413)
  assert.equal((await images.POST(request('POST', '', {}), context)).status, 415)
  for (const imageType of ['employee', 'company']) {
    assert.equal((await imageDelete.DELETE(request('DELETE'), { params: Promise.resolve({ userId: accountId, imageType }) })).status, 200)
    assert.match(calls.at(-1).url, new RegExp('/images/' + imageType + '$'))
  }
  assert.equal((await imageDelete.DELETE(request('DELETE'), { params: Promise.resolve({ userId: accountId, imageType: '../auth' }) })).status, 400)
  console.log('PASS: Employee API authentication, query/body/path validation, origin protection, backend status mapping, cookie privacy, image limits, and route forwarding.')
} finally {
  globalThis.fetch = originalFetch
}
