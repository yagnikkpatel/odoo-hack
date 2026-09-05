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
const id = '22222222-2222-4222-8222-222222222222'
const employeeId = '11111111-1111-4111-8111-111111111111'
const origin = 'https://peoplepay.example'
let token = 'isolated-session-token'
let user = { id: employeeId, role: 'admin' }
let authUnavailable = false
let status = 200
let payload = { success: true, data: null }
const calls = []
const originalFetch = globalThis.fetch
globalThis.fetch = async (url, options) => {
  calls.push({ url, options })
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } })
}
const json = (body, code = 200) => NextResponse.json(body, {
  status: code, headers: { 'Cache-Control': 'no-store, private' },
})
const mocks = {
  'server-only': {},
  'next/headers': { cookies: async () => ({ get: () => token ? { value: token } : undefined }) },
  '@/features/nexacrm/contexts/currentUserContext': { useCurrentUser: () => ({ user }) },
  '@/features/employees/service': {
    listEmployeeOptions: async () => [{ id: employeeId, name: 'Ada', email: 'ada@example.test' }],
    listEmployees: async ({ offset }) => ({
      employees: [{ id: offset ? id : employeeId, name: offset ? 'Grace' : 'Ada', email: 'person@example.test' }],
      pagination: { hasMore: offset === 0 },
    }),
  },
  '@/features/auth/auth-server': {
    authJson: json,
    authError: (message, code) => json({ success: false, message }, code),
    checkSameOrigin: request => {
      if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') return json({ success: false }, 403)
      return null
    },
    readVerifiedUser: async () => {
      if (authUnavailable) throw new Error('Unavailable test dependency')
      return user
    },
  },
}
function load(relative) {
  let file = path.resolve(root, relative)
  if (!existsSync(file)) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const loaded = { exports: {} }
  modules.set(file, loaded)
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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
function request(method = 'GET', suffix = '', body, headers = {}) {
  const options = { method, headers: { Origin: origin, ...headers } }
  if (body !== undefined) {
    options.body = JSON.stringify(body)
    options.headers['Content-Type'] = 'application/json'
  }
  return new Request(`${origin}/api/attendance${suffix}`, options)
}
const routes = {
  list: load('app/api/attendance/route'),
  detail: load('app/api/attendance/[id]/route'),
  mine: load('app/api/attendance/me/route'),
  today: load('app/api/attendance/me/today/route'),
  checkIn: load('app/api/attendance/check-in/route'),
  checkOut: load('app/api/attendance/check-out/route'),
}
const context = { params: Promise.resolve({ id }) }
const input = { employeeId, attendanceDate: '2026-09-04', checkIn: '2026-09-04T03:30:00.000Z', overtimeHours: 0 }
const record = {
  ...input, id, employeeName: 'Ada', employeeEmail: 'ada@example.test',
  checkOut: null, workedHours: 0, status: 'incomplete',
  editedBy: null, editedByName: null, editedAt: null, editReason: null,
  createdAt: '2026-09-04T03:30:00.000Z', updatedAt: '2026-09-04T03:30:00.000Z',
}
try {
  token = ''
  assert.equal((await routes.list.GET(request())).status, 401)
  assert.equal(calls.length, 0)
  token = 'isolated-session-token'
  user = null
  assert.equal((await routes.list.GET(request())).status, 401)
  user = { id: employeeId, role: 'admin' }
  authUnavailable = true
  assert.equal((await routes.list.GET(request())).status, 503)
  authUnavailable = false

  const response = await routes.list.GET(request('GET', `?limit=10&offset=20&status=present&employeeId=${employeeId}&search=Ada&from=2026-09-01&to=2026-09-04`))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal((await response.text()).includes(token), false)
  assert.match(calls.at(-1).url, /\/attendance\?limit=10&offset=20&status=present&employeeId=.*&search=Ada&from=2026-09-01&to=2026-09-04$/)
  assert.equal(calls.at(-1).options.headers.get('authorization'), `Bearer ${token}`)
  assert.equal(calls.at(-1).options.cache, 'no-store')
  assert.equal(calls.at(-1).options.redirect, 'error')

  for (const query of ['?limit=0', '?limit=101', '?offset=-1', '?status=open', '?employeeId=bad', '?search=', '?sort=name', '?limit=1&limit=2', '?from=2026-02-30', '?from=2026-09-04&to=2026-09-01']) {
    assert.equal((await routes.list.GET(request('GET', query))).status, 400, query)
  }
  for (const query of [`?employeeId=${employeeId}`, '?search=Ada']) {
    assert.equal((await routes.mine.GET(request('GET', query))).status, 400, query)
  }
  await routes.mine.GET(request('GET', '?status=absent&from=2026-09-01'))
  assert.match(calls.at(-1).url, /\/attendance\/me\?status=absent&from=2026-09-01$/)
  await routes.today.GET(request())
  assert.match(calls.at(-1).url, /\/attendance\/me\/today$/)
  await routes.detail.GET(request(), context)
  assert.match(calls.at(-1).url, new RegExp(`/attendance/${id}$`))
  assert.equal((await routes.detail.GET(request(), { params: Promise.resolve({ id: '../auth/me' }) })).status, 400)

  status = 201
  payload = { success: true, data: record }
  assert.equal((await routes.list.POST(request('POST', '', input))).status, 201)
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), input)
  assert.equal((await routes.checkIn.POST(request('POST'))).status, 201)
  assert.match(calls.at(-1).url, /\/attendance\/check-in$/)
  assert.equal(calls.at(-1).options.body, undefined)
  status = 200
  assert.equal((await routes.checkOut.POST(request('POST'))).status, 200)
  assert.match(calls.at(-1).url, /\/attendance\/check-out$/)
  assert.equal(calls.at(-1).options.body, undefined)
  const update = { checkIn: null, checkOut: null, status: 'absent', overtimeHours: 1.5, editReason: 'Corrected entry' }
  assert.equal((await routes.detail.PATCH(request('PATCH', '', update), context)).status, 200)
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), update)
  assert.equal((await routes.detail.DELETE(request('DELETE'), context)).status, 200)
  assert.equal(calls.at(-1).options.method, 'DELETE')

  for (const body of [{}, { employeeId }, { attendanceDate: '2026-09-04' }, { breakMinutes: 5 }, { overtimeHours: 25 }, { overtimeHours: '2' }, { status: 'open' }, { editReason: '' }, { editReason: 'x'.repeat(501) }, { checkIn: '2026-09-04T09:00' }, { checkIn: '2026-02-30T09:00:00Z' }]) {
    assert.equal((await routes.detail.PATCH(request('PATCH', '', body), context)).status, 400, JSON.stringify(body))
  }
  for (const body of [{}, { ...input, checkIn: null }, { ...input, attendanceDate: '2026-02-30' }, { employeeId, attendanceDate: input.attendanceDate, checkOut: input.checkIn }, { ...input, checkOut: input.checkIn }]) {
    assert.equal((await routes.list.POST(request('POST', '', body))).status, 400, JSON.stringify(body))
  }
  assert.equal((await routes.list.POST(request('POST'))).status, 415)
  assert.equal((await routes.list.POST(new Request(`${origin}/api/attendance`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: '{' }))).status, 400)
  assert.equal((await routes.detail.PATCH(request('PATCH', '', { editReason: 'x'.repeat(20_000) }), context)).status, 413)
  for (const headers of [{ Origin: 'https://foreign.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await routes.checkIn.POST(request('POST', '', undefined, headers))).status, 403)
    assert.equal((await routes.detail.DELETE(request('DELETE', '', undefined, headers), context)).status, 403)
  }
  assert.equal((await routes.checkOut.POST(new Request(`${origin}/api/attendance/check-out`, { method: 'POST' }))).status, 403)

  for (const expected of [400, 401, 403, 404, 409, 413, 415, 422, 429]) {
    status = expected
    payload = { success: false, message: 'Known public error' }
    assert.equal((await routes.list.GET(request())).status, expected)
  }
  status = 500
  payload = { message: 'Private database internals' }
  const failure = await routes.list.GET(request())
  assert.equal(failure.status, 502)
  assert.equal((await failure.text()).includes('Private database'), false)
  status = 200
  payload = { invalid: true }
  assert.equal((await routes.list.GET(request())).status, 502)

  const mapper = load('features/attendance/attendance-mapper')
  assert.deepEqual(mapper.mapAttendance(record), record)
  for (const change of [{ attendanceDate: '2026-02-30' }, { status: 'open' }, { checkIn: 'invalid' }, { workedHours: '8' }, { overtimeHours: -1 }, { editedBy: 'bad' }]) {
    assert.throws(() => mapper.mapAttendance({ ...record, ...change }))
  }
  assert.throws(() => mapper.mapPagination({ total: 1, offset: 0, limit: 0, hasMore: false }))
  assert.throws(() => mapper.mapPagination({ total: 1, offset: 0, limit: 20, hasMore: 'false' }))
  const helpers = load('features/attendance/types')
  assert.equal(helpers.companyDateTime(new Date('2026-09-04T20:00:00Z')), '2026-09-05T01:30')
  assert.equal(helpers.toAttendanceTimestamp('2026-09-05T01:30'), '2026-09-04T20:00:00.000Z')
  assert.equal(helpers.validDateTime('2026-02-30T09:00'), false)
  assert.equal(helpers.validDateTime('2026-09-04T24:00'), false)
  assert.equal(helpers.hoursLabel(119.9), '2h 0m')
  assert.equal(helpers.workedMinutes({ workedHours: 7.5 }), 450)
  assert.equal(helpers.dateTimeLabel(null), '—')
  const permissions = load('features/attendance/permissions')
  for (const role of ['admin', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager', 'employee']) {
    const access = permissions.attendancePermissions(role)
    assert.equal(access.canReadOwn, true)
    assert.equal(access.canCheckIn, true)
    for (const key of ['canReadAny', 'canCreate', 'canUpdate', 'canDelete']) assert.equal(access[key], role !== 'employee')
  }

  const service = load('features/attendance/service')
  payload = { success: true, data: { attendances: [record], pagination: { total: 1, limit: 20, offset: 0, hasMore: false } } }
  assert.equal((await service.listAttendances({ scope: 'own', limit: 20, offset: 0, status: 'incomplete' })).attendances[0].id, id)
  assert.equal(calls.at(-1).url, '/api/attendance/me?limit=20&offset=0&status=incomplete')
  await service.listAttendances({ scope: 'all', limit: 20, offset: 0, search: 'Ada' })
  assert.equal(calls.at(-1).url, '/api/attendance?limit=20&offset=0&search=Ada')
  await assert.rejects(service.listAttendances({ scope: 'own', limit: 20, offset: 0, employeeId }), /does not support/)
  payload = { success: true, data: null }
  assert.equal(await service.getMyTodayAttendance(), null)
  payload = { success: true, data: record }
  await service.getAttendance(id)
  assert.equal(calls.at(-1).url, `/api/attendance/${id}`)
  await service.checkIn()
  assert.equal(calls.at(-1).url, '/api/attendance/check-in')
  await service.checkOut()
  assert.equal(calls.at(-1).url, '/api/attendance/check-out')
  await service.createAttendance(input)
  assert.equal(calls.at(-1).options.method, 'POST')
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), input)
  await service.updateAttendance(id, update)
  assert.equal(calls.at(-1).options.method, 'PATCH')
  assert.deepEqual(JSON.parse(calls.at(-1).options.body), update)
  payload = { success: true, data: { id } }
  await service.deleteAttendance(id)
  assert.equal(calls.at(-1).options.method, 'DELETE')
  assert.equal(calls.at(-1).options.credentials, 'same-origin')
  assert.equal(calls.at(-1).options.cache, 'no-store')
  await assert.rejects(service.getAttendance('../me'), /valid attendance ID/)
  assert.equal((await service.listAttendanceEmployees()).length, 2)
  status = 403
  payload = { success: false, message: 'Not permitted' }
  await assert.rejects(service.checkIn(), /Not permitted/)
  console.log('PASS: All nine attendance endpoints, authenticated BFF, origin protection, validation, response mapping, own/all scope, role visibility, employee options, and IST timestamps.')
} finally {
  globalThis.fetch = originalFetch
}
