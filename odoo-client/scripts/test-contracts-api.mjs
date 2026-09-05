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
const contractId = '22222222-2222-4222-8222-222222222222'
const employeeId = '11111111-1111-4111-8111-111111111111'
const origin = 'https://peoplepay.example'
let sessionToken = 'isolated-session-token'
let user = { id: employeeId, role: 'admin' }
let authUnavailable = false
let status = 200
let payload = {
  success: true,
  data: {
    contracts: [],
    pagination: { total: 0, limit: 15, offset: 0, hasMore: false }
  }
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

const list = load('app/api/contracts/route.ts')
const detail = load('app/api/contracts/[id]/route.ts')
const context = { params: Promise.resolve({ id: contractId }) }

function request(method = 'GET', suffix = '', body, headers = {}) {
  const options = { method, headers: { Origin: origin, ...headers } }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
    options.headers['Content-Type'] = 'application/json'
  }
  return new Request(origin + '/api/contracts' + suffix, options)
}

const input = {
  employeeId,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  wage: 85000,
  status: 'running'
}

try {
  sessionToken = ''
  assert.equal((await list.GET(request())).status, 401)
  assert.equal(calls.length, 0)
  sessionToken = 'isolated-session-token'
  user = null
  assert.equal((await list.GET(request())).status, 401)
  user = { id: employeeId, role: 'admin' }
  authUnavailable = true
  assert.equal((await list.GET(request())).status, 503)
  authUnavailable = false

  const response = await list.GET(request(
    'GET',
    `?limit=10&offset=20&status=expired&employeeId=${employeeId}&search=Ada`
  ))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal((await response.text()).includes(sessionToken), false)
  const forwarded = calls.at(-1)
  assert.match(forwarded.url, /\/contracts\?limit=10&offset=20&status=expired&employeeId=.*&search=Ada$/)
  assert.equal(forwarded.options.headers.get('authorization'), `Bearer ${sessionToken}`)
  assert.equal(forwarded.options.cache, 'no-store')
  assert.equal(forwarded.options.redirect, 'error')

  for (const query of [
    '?limit=0',
    '?limit=101',
    '?offset=-1',
    '?status=active',
    '?employeeId=bad',
    '?search=',
    '?page=2',
    '?limit=1&limit=2'
  ]) {
    assert.equal((await list.GET(request('GET', query))).status, 400, query)
  }

  await detail.GET(request(), context)
  assert.match(calls.at(-1).url, new RegExp(`/contracts/${contractId}$`))
  assert.equal((await detail.GET(request(), {
    params: Promise.resolve({ id: '../auth/me' })
  })).status, 400)

  status = 201
  payload = { success: true, data: { id: contractId } }
  assert.equal((await list.POST(request('POST', '', input))).status, 201)
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), input)
  status = 200
  assert.equal((await detail.PATCH(request('PATCH', '', {
    startDate: input.startDate,
    endDate: input.endDate,
    wage: 90000,
    status: 'expired'
  }), context)).status, 200)

  for (const body of [
    {},
    { employeeId },
    { name: 'Unsupported' },
    { wage: 0 },
    { wage: '85000' },
    { status: 'active' },
    { startDate: 'not-a-date' }
  ]) {
    assert.equal((await detail.PATCH(request('PATCH', '', body), context)).status, 400)
  }
  assert.equal((await list.POST(request('POST', '', { wage: 1 }))).status, 400)
  assert.equal((await list.POST(request('POST'))).status, 415)
  assert.equal((await list.POST(new Request(origin + '/api/contracts', {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: '{'
  }))).status, 400)
  assert.equal((await detail.PATCH(request('PATCH', '', {
    status: 'x'.repeat(20_000)
  }), context)).status, 413)

  assert.equal((await detail.DELETE(request('DELETE', '', undefined, {
    Origin: 'https://foreign.example'
  }), context)).status, 403)
  assert.equal((await detail.DELETE(new Request(origin + '/api/contracts', {
    method: 'DELETE'
  }), context)).status, 403)
  assert.equal((await detail.DELETE(request('DELETE', '', undefined, {
    'sec-fetch-site': 'cross-site'
  }), context)).status, 403)

  for (const expected of [400, 401, 403, 404, 409, 413, 415, 422, 429]) {
    status = expected
    payload = { success: false, message: 'Known public contract error' }
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

  console.log('PASS: Contract API authentication, query/body/path validation, origin protection, backend status mapping, cookie privacy, and route forwarding.')
} finally {
  globalThis.fetch = originalFetch
}
