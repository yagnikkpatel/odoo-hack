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
    readAuthBody: async request => request.json().catch(() => null),
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
const route = load('app/api/employees/places/route.ts')
const originalKey = process.env.GOOGLE_PLACES_API_KEY
const session = '12345678-1234-4234-8234-123456789012'
const suggestion = { placeId: 'test_place', structuredFormat: { mainText: { text: 'Office' }, secondaryText: { text: 'Ahmedabad, India' } } }
const body = { action: 'autocomplete', input: 'ahmed', sessionToken: session }
const send = (data, headers = {}) => route.POST(new Request(origin + '/api/employees/places', {
  method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(data),
}))
try {
  delete process.env.GOOGLE_PLACES_API_KEY
  let result = await send({ action: 'status' })
  assert.deepEqual((await result.json()).data, { configured: false })
  assert.equal((await send(body)).status, 503)
  assert.equal(calls.length, 0)
  process.env.GOOGLE_PLACES_API_KEY = 'fixture-secret-key'
  sessionToken = ''
  assert.equal((await send(body)).status, 401)
  sessionToken = 'isolated-session-token'
  user = { id: accountId, role: 'employee' }
  assert.equal((await send(body)).status, 403)
  user = { id: accountId, role: 'admin', permissions: [] }
  assert.equal((await send(body)).status, 403)
  user = { id: accountId, role: 'admin' }
  assert.equal((await send(body, { Origin: 'https://foreign.example' })).status, 403)
  for (const invalid of [
    { ...body, input: '' }, { ...body, input: 'a'.repeat(201) }, { ...body, sessionToken: 'invalid' },
    { ...body, action: 'other' }, { action: 'details', placeId: '../config', sessionToken: session },
  ]) assert.equal((await send(invalid)).status, 400)
  assert.equal(calls.length, 0)
  payload = { suggestions: [{ placePrediction: suggestion }, { queryPrediction: {} }] }
  result = await send(body)
  assert.equal(result.status, 200)
  const output = await result.text()
  assert(!output.includes('fixture-secret-key'))
  assert.deepEqual(JSON.parse(output).data.suggestions, [{ placeId: 'test_place', mainText: 'Office', secondaryText: 'Ahmedabad, India' }])
  assert.equal(calls.at(-1).url, 'https://places.googleapis.com/v1/places:autocomplete')
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), { input: 'ahmed', sessionToken: session, includedRegionCodes: ['in'], languageCode: 'en' })
  assert.equal(calls.at(-1).options.headers['X-Goog-Api-Key'], 'fixture-secret-key')
  assert.equal(calls.at(-1).options.cache, 'no-store')
  payload = { id: 'test_place', formattedAddress: 'Ahmedabad, India', location: { latitude: 0, longitude: 72.57 } }
  const details = { action: 'details', placeId: 'test_place', sessionToken: session }
  result = await send(details)
  assert.equal(result.status, 200)
  assert.deepEqual((await result.json()).data, { latitude: 0, longitude: 72.57, formattedAddress: 'Ahmedabad, India', attributions: [] })
  assert.equal(new URL(calls.at(-1).url).searchParams.get('sessionToken'), session)
  assert.equal(calls.at(-1).options.headers['X-Goog-FieldMask'], 'id,formattedAddress,location,attributions')
  assert.equal(calls.at(-1).options.method, 'GET')
  payload = { id: 'test_place' }
  assert.equal((await send(details)).status, 422)
  payload = { id: 'test_place', location: { latitude: 91, longitude: 0 } }
  assert.equal((await send(details)).status, 422)
  payload = {}
  assert.deepEqual((await (await send(body)).json()).data.suggestions, [])
  status = 403; payload = { error: { message: 'private upstream config fixture-secret-key' } }
  result = await send(body)
  assert.equal(result.status, 502)
  assert(!(await result.text()).includes('private upstream'))
  status = 429
  assert.equal((await send(body)).status, 429)
  status = 200; payload = {}
  while (calls.length < 60) assert.equal((await send(body)).status, 200)
  const before = calls.length
  assert.equal((await send(body)).status, 429)
  assert.equal(calls.length, before, 'Rate limit must stop requests before Google')
  console.log('PASS: Places permissions, same-origin protection, missing-key fallback, autocomplete, coordinate lookup, session forwarding, field masks, validation, error privacy and rate limiting.')
} finally {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY
  else process.env.GOOGLE_PLACES_API_KEY = originalKey
}
