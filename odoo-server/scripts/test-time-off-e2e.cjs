/**
 * End-to-end test for the Time Off API.
 *
 * Unlike the other scripts in this folder, this one talks to a REAL running server,
 * database and Redis. Start them first:
 *
 *   npm run docker:up && npm run migrate && npm run dev
 *   node scripts/test-time-off-e2e.cjs
 *
 * It uses exactly ONE user (timeoff@test.com), which is both the actor and the
 * employee every allocation and request belongs to. The user is given the admin
 * role so a single login can reach every endpoint, including the approve routes.
 * It is upserted, so re-running never creates a second account.
 *
 * Every record it creates uses the E2E code prefix, and cleanup deletes only those
 * rows — it never touches real data.
 */
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
require('dotenv').config()

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:4000/api').replace(/\/$/, '')
const USER = { name: 'timeoff', email: 'timeoff@test.com', password: 'test@1234', role: 'admin' }
const CODE_PREFIX = 'E2E'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let token = ''
let employeeId = ''
let passed = 0

function step(name) {
  passed += 1
  console.log(`  ${String(passed).padStart(2, ' ')}. ${name}`)
}

async function api(method, path, { body, auth = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (auth && token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  } catch (error) {
    throw new Error(`Cannot reach ${BASE_URL} — is the server running? (${error.message})`)
  }
  const payload = await response.json().catch(() => null)
  return { status: response.status, payload }
}

/** Asserts a 2xx and returns the unwrapped `data`. */
async function ok(method, path, options = {}) {
  const { status, payload } = await api(method, path, options)
  assert.equal(
    payload?.success,
    true,
    `${method} ${path} expected success, got ${status}: ${JSON.stringify(payload)}`
  )
  return payload.data
}

/** Asserts a specific failure status and the error envelope. */
async function fails(method, path, expectedStatus, options = {}) {
  const { status, payload } = await api(method, path, options)
  assert.equal(status, expectedStatus, `${method} ${path} expected ${expectedStatus}, got ${status}: ${JSON.stringify(payload)}`)
  assert.equal(payload?.success, false, `${method} ${path} should return the error envelope`)
  assert.equal(typeof payload.message, 'string')
  return payload.message
}

/** A future Monday, so weekday maths is stable regardless of when the test runs. */
function monday(offsetDays = 0) {
  const date = new Date()
  date.setUTCHours(12, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() + (((8 - date.getUTCDay()) % 7) || 7) + offsetDays)
  return date.toISOString().slice(0, 10)
}

async function ensureUser() {
  const role = await pool.query('SELECT id FROM roles WHERE name = $1', [USER.role])
  assert.ok(role.rows[0], `role ${USER.role} is missing — run npm run migrate`)
  const hash = await bcrypt.hash(USER.password, 12)
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, role_id = EXCLUDED.role_id, status = 'active', updated_at = NOW()
     RETURNING id`,
    [USER.name, USER.email, hash, role.rows[0].id]
  )
  return result.rows[0].id
}

/** Removes only rows this test created, by code prefix. Safe to run repeatedly. */
async function cleanup() {
  const types = `SELECT id FROM time_off_types WHERE code LIKE '${CODE_PREFIX}%'`
  await pool.query(`DELETE FROM time_off_requests WHERE type_id IN (${types})`)
  await pool.query(`DELETE FROM time_off_allocations WHERE type_id IN (${types})`)
  await pool.query(`DELETE FROM time_off_types WHERE code LIKE '${CODE_PREFIX}%'`)
}

/**
 * The test account is an admin with a known weak password, so it must not outlive
 * the run. Its time off rows cascade. Pass --keep-user to leave it for debugging.
 */
async function removeUser() {
  if (process.argv.includes('--keep-user')) return
  await pool.query('DELETE FROM users WHERE email = $1', [USER.email])
}

async function main() {
  console.log(`Time Off end-to-end test against ${BASE_URL}\n`)

  const tables = await pool.query(
    `SELECT COUNT(*)::int AS count FROM information_schema.tables
     WHERE table_name IN ('time_off_types', 'time_off_allocations', 'time_off_requests')`
  )
  assert.equal(tables.rows[0].count, 3, 'time off tables are missing — run npm run migrate')

  employeeId = await ensureUser()
  await cleanup()

  console.log('Auth')
  const login = await ok('POST', '/auth/login', { body: { email: USER.email, password: USER.password }, auth: false })
  assert.ok(login.accessToken, 'login must return an access token')
  token = login.accessToken
  step(`POST /auth/login as ${USER.email}`)

  await fails('GET', '/time-off', 401, { auth: false })
  step('GET /time-off without a token is rejected 401')

  console.log('\nSnapshot')
  const snapshot = await ok('GET', '/time-off')
  for (const key of ['types', 'allocations', 'requests']) {
    assert.ok(Array.isArray(snapshot[key]), `snapshot.${key} must be an array`)
  }
  step('GET /time-off returns { types, allocations, requests }')

  console.log('\nTime off types')
  const dayType = await ok('POST', '/time-off/types', {
    body: {
      name: 'E2E Annual Leave',
      code: `${CODE_PREFIX}DAY`,
      unit: 'days',
      requiresAllocation: true,
      approval: 'manager',
      payroll: 'paid',
      active: true,
      description: 'Created by the end-to-end test.'
    }
  })
  assert.match(dayType.id, /^[0-9a-f-]{36}$/, 'type id must be a uuid')
  assert.equal(dayType.code, `${CODE_PREFIX}DAY`, 'code must be stored uppercase')
  step('POST /time-off/types creates a day-unit type')

  // approval 'none' + requiresAllocation false exercises the auto-approve branch.
  const hourType = await ok('POST', '/time-off/types', {
    body: {
      name: 'E2E Time Off In Lieu',
      code: `${CODE_PREFIX}hr`,
      unit: 'hours',
      requiresAllocation: false,
      approval: 'none',
      payroll: 'unpaid',
      active: true,
      description: ''
    }
  })
  assert.equal(hourType.code, `${CODE_PREFIX}HR`, 'lowercase code input must be uppercased by the server')
  step('POST /time-off/types uppercases a lowercase code')

  await fails('POST', '/time-off/types', 409, {
    body: {
      name: 'e2e annual leave',
      code: `${CODE_PREFIX}NEW`,
      unit: 'days',
      requiresAllocation: true,
      approval: 'manager',
      payroll: 'paid',
      active: true,
      description: ''
    }
  })
  step('POST /time-off/types rejects a duplicate name case-insensitively')

  await fails('POST', '/time-off/types', 400, {
    body: {
      name: 'E2E Bad Code',
      code: 'not a valid code!',
      unit: 'days',
      requiresAllocation: true,
      approval: 'manager',
      payroll: 'paid',
      active: true,
      description: ''
    }
  })
  step('POST /time-off/types rejects a malformed code')

  const typeList = await ok('GET', '/time-off/types')
  assert.ok(typeList.types.some(item => item.id === dayType.id), 'created type must appear in the list')
  step('GET /time-off/types lists the created types')

  const fetchedType = await ok('GET', `/time-off/types/${dayType.id}`)
  assert.equal(fetchedType.id, dayType.id)
  step('GET /time-off/types/:id returns the type')

  const patchedType = await ok('PATCH', `/time-off/types/${dayType.id}`, {
    body: { description: 'Updated by the end-to-end test.' }
  })
  assert.equal(patchedType.description, 'Updated by the end-to-end test.')
  step('PATCH /time-off/types/:id updates the description')

  console.log('\nAllocations')
  const allocation = await ok('POST', '/time-off/allocations', {
    body: { employeeId, typeId: dayType.id, amount: 10, validFrom: monday(), validTo: '', note: 'E2E grant' }
  })
  assert.equal(allocation.status, 'pending', 'a new allocation starts pending')
  assert.equal(allocation.validTo, '', 'an open-ended allocation must serialise validTo as an empty string')
  assert.equal(allocation.amount, 10)
  assert.ok(Array.isArray(allocation.history) && allocation.history.length >= 1, 'history must record the submission')
  step('POST /time-off/allocations creates a pending allocation')

  await fails('POST', '/time-off/allocations', 400, {
    body: { employeeId, typeId: hourType.id, amount: 5, validFrom: monday(), validTo: '', note: '' }
  })
  step('POST /time-off/allocations rejects a type that does not require allocation')

  await fails('POST', '/time-off/allocations', 400, {
    body: { employeeId, typeId: dayType.id, amount: -5, validFrom: monday(), validTo: '', note: '' }
  })
  step('POST /time-off/allocations rejects a negative amount')

  const allocationList = await ok('GET', '/time-off/allocations')
  assert.ok(allocationList.allocations.some(item => item.id === allocation.id))
  step('GET /time-off/allocations lists it')

  const myAllocations = await ok('GET', '/time-off/allocations/me')
  assert.ok(myAllocations.allocations.some(item => item.id === allocation.id), 'the actor is the employee, so /me must include it')
  step('GET /time-off/allocations/me is scoped to the caller')

  await ok('GET', `/time-off/allocations/${allocation.id}`)
  step('GET /time-off/allocations/:id returns the allocation')

  const patchedAllocation = await ok('PATCH', `/time-off/allocations/${allocation.id}`, {
    body: { employeeId, typeId: dayType.id, amount: 12, validFrom: monday(), validTo: '', note: 'Raised to 12' }
  })
  assert.equal(patchedAllocation.amount, 12)
  step('PATCH /time-off/allocations/:id updates a pending allocation')

  const approvedAllocation = await ok('POST', `/time-off/allocations/${allocation.id}/approve`)
  assert.equal(approvedAllocation.status, 'approved')
  step('POST /time-off/allocations/:id/approve approves it')

  await fails('POST', `/time-off/allocations/${allocation.id}/approve`, 409)
  step('POST /time-off/allocations/:id/approve twice is rejected 409')

  await fails('PATCH', `/time-off/allocations/${allocation.id}`, 409, {
    body: { employeeId, typeId: dayType.id, amount: 99, validFrom: monday(), validTo: '', note: '' }
  })
  step('PATCH on an approved allocation is rejected 409')

  const refusable = await ok('POST', '/time-off/allocations', {
    body: { employeeId, typeId: dayType.id, amount: 3, validFrom: monday(70), validTo: '', note: 'To refuse' }
  })
  await fails('POST', `/time-off/allocations/${refusable.id}/refuse`, 400, { body: { reason: '   ' } })
  step('POST /time-off/allocations/:id/refuse requires a non-empty reason')

  const refusedAllocation = await ok('POST', `/time-off/allocations/${refusable.id}/refuse`, {
    body: { reason: 'Not approved by the end-to-end test.' }
  })
  assert.equal(refusedAllocation.status, 'refused')
  assert.ok(
    refusedAllocation.history.some(entry => entry.reason?.includes('end-to-end')),
    'the refusal reason must be recorded in history'
  )
  step('POST /time-off/allocations/:id/refuse records the reason in history')

  console.log('\nRequests')
  const request = await ok('POST', '/time-off/requests', {
    body: {
      employeeId,
      typeId: dayType.id,
      startDate: monday(),
      endDate: monday(2),
      startTime: '',
      endTime: '',
      reason: 'E2E three day leave'
    }
  })
  assert.equal(request.status, 'pending', 'manager-approval types start pending')
  assert.equal(request.unit, 'days')
  assert.equal(request.duration, 3, 'Monday to Wednesday is three working days')
  assert.equal(request.charges.length, 3, 'one charge per working day')
  assert.deepEqual(request.consumptions, [], 'nothing is consumed before approval')
  step('POST /time-off/requests computes duration and charges server-side')

  // The server must recompute, never trust, the client's arithmetic.
  const tampered = await ok('POST', '/time-off/requests', {
    body: {
      employeeId,
      typeId: dayType.id,
      startDate: monday(28),
      endDate: monday(28),
      startTime: '',
      endTime: '',
      reason: 'E2E tamper check',
      duration: 999,
      charges: [{ date: monday(28), amount: 999 }],
      status: 'approved'
    }
  })
  assert.equal(tampered.duration, 1, 'a client-supplied duration must be ignored')
  assert.notEqual(tampered.status, 'approved', 'a client-supplied status must be ignored')
  step('POST /time-off/requests ignores client-supplied duration, charges and status')
  await ok('DELETE', `/time-off/requests/${tampered.id}`)

  await fails('POST', '/time-off/requests', 409, {
    body: {
      employeeId,
      typeId: dayType.id,
      startDate: monday(1),
      endDate: monday(3),
      startTime: '',
      endTime: '',
      reason: 'E2E overlapping leave'
    }
  })
  step('POST /time-off/requests rejects an overlapping request 409')

  await fails('POST', '/time-off/requests', 400, {
    body: {
      employeeId,
      typeId: dayType.id,
      startDate: monday(9),
      endDate: monday(7),
      startTime: '',
      endTime: '',
      reason: 'E2E reversed dates'
    }
  })
  step('POST /time-off/requests rejects an end date before the start date')

  const requestList = await ok('GET', '/time-off/requests')
  assert.ok(requestList.requests.some(item => item.id === request.id))
  step('GET /time-off/requests lists it')

  const myRequests = await ok('GET', '/time-off/requests/me')
  assert.ok(myRequests.requests.some(item => item.id === request.id))
  step('GET /time-off/requests/me is scoped to the caller')

  await ok('GET', `/time-off/requests/${request.id}`)
  step('GET /time-off/requests/:id returns the request')

  const patchedRequest = await ok('PATCH', `/time-off/requests/${request.id}`, {
    body: {
      employeeId,
      typeId: dayType.id,
      startDate: monday(),
      endDate: monday(4),
      startTime: '',
      endTime: '',
      reason: 'E2E extended to five days'
    }
  })
  assert.equal(patchedRequest.duration, 5, 'Monday to Friday is five working days')
  step('PATCH /time-off/requests/:id recomputes the duration')

  const approvedRequest = await ok('POST', `/time-off/requests/${request.id}/approve`)
  assert.equal(approvedRequest.status, 'approved')
  assert.equal(
    approvedRequest.consumptions.reduce((total, item) => total + item.amount, 0),
    5,
    'approval must consume five days from the allocation'
  )
  assert.ok(
    approvedRequest.consumptions.every(item => item.allocationId === allocation.id),
    'consumption must point at the approved allocation'
  )
  step('POST /time-off/requests/:id/approve consumes the allocation')

  await fails('DELETE', `/time-off/requests/${request.id}`, 409)
  step('DELETE on an approved request is rejected 409')

  await fails('PATCH', `/time-off/requests/${request.id}`, 409, {
    body: {
      employeeId,
      typeId: dayType.id,
      startDate: monday(),
      endDate: monday(1),
      startTime: '',
      endTime: '',
      reason: 'E2E edit after approval'
    }
  })
  step('PATCH on an approved request is rejected 409')

  // 12 allocated, 5 consumed: a 10-working-day request cannot fit in the remaining 7.
  const shortfall = await fails('POST', '/time-off/requests', 409, {
    body: {
      employeeId,
      typeId: dayType.id,
      startDate: monday(35),
      endDate: monday(46),
      startTime: '',
      endTime: '',
      reason: 'E2E exceeds the remaining balance'
    }
  })
  assert.match(shortfall, /\d{4}-\d{2}-\d{2}/, 'the shortfall message should name the date it ran out on')
  step('POST /time-off/requests rejects an over-balance request 409')

  const cancelled = await ok('POST', `/time-off/requests/${request.id}/cancel`, {
    body: { reason: 'E2E cancellation' }
  })
  assert.equal(cancelled.status, 'cancelled')
  assert.ok(cancelled.consumptions.length > 0, 'consumptions are retained on a cancelled request for audit')
  step('POST /time-off/requests/:id/cancel releases the balance and keeps the audit trail')

  const afterCancel = await ok('POST', '/time-off/requests', {
    body: {
      employeeId,
      typeId: dayType.id,
      startDate: monday(35),
      endDate: monday(39),
      startTime: '',
      endTime: '',
      reason: 'E2E after the balance was released'
    }
  })
  step('POST /time-off/requests succeeds again once the cancelled balance is released')

  const refusedRequest = await ok('POST', `/time-off/requests/${afterCancel.id}/refuse`, {
    body: { reason: 'E2E refusal' }
  })
  assert.equal(refusedRequest.status, 'refused')
  assert.deepEqual(refusedRequest.consumptions, [], 'a refused request consumes nothing')
  step('POST /time-off/requests/:id/refuse consumes no balance')

  console.log('\nHourly leave and auto-approval')
  const hourly = await ok('POST', '/time-off/requests', {
    body: {
      employeeId,
      typeId: hourType.id,
      startDate: monday(21),
      endDate: monday(21),
      startTime: '10:00',
      endTime: '14:00',
      reason: 'E2E four hours'
    }
  })
  assert.equal(hourly.unit, 'hours')
  assert.equal(hourly.duration, 4, '10:00 to 14:00 is four hours')
  assert.equal(hourly.status, 'approved', "an approval policy of 'none' auto-approves")
  assert.deepEqual(hourly.consumptions, [], 'a type that needs no allocation consumes nothing')
  step('POST /time-off/requests auto-approves an hours-unit request')

  await fails('POST', '/time-off/requests', 400, {
    body: {
      employeeId,
      typeId: hourType.id,
      startDate: monday(22),
      endDate: monday(23),
      startTime: '10:00',
      endTime: '14:00',
      reason: 'E2E multi-day hourly'
    }
  })
  step('POST /time-off/requests rejects hourly leave spanning two days')

  await fails('POST', '/time-off/requests', 400, {
    body: {
      employeeId,
      typeId: hourType.id,
      startDate: monday(24),
      endDate: monday(24),
      startTime: '14:00',
      endTime: '10:00',
      reason: 'E2E reversed times'
    }
  })
  step('POST /time-off/requests rejects an end time before the start time')

  await fails('POST', '/time-off/requests', 400, {
    body: {
      employeeId,
      typeId: hourType.id,
      startDate: monday(25),
      endDate: monday(25),
      startTime: '08:00',
      endTime: '20:00',
      reason: 'E2E beyond the working day'
    }
  })
  step('POST /time-off/requests rejects hourly leave beyond the scheduled day')

  console.log('\nReferential integrity and deletion')
  await fails('DELETE', `/time-off/types/${dayType.id}`, 409)
  step('DELETE on a referenced type is rejected 409')

  await fails('PATCH', `/time-off/types/${dayType.id}`, 409, { body: { unit: 'hours' } })
  step('PATCH cannot change the unit of a referenced type')

  const deletedRequest = await ok('DELETE', `/time-off/requests/${refusedRequest.id}`)
  assert.equal(deletedRequest.id, refusedRequest.id, 'delete must echo the id')
  step('DELETE /time-off/requests/:id removes a refused request')

  await fails('GET', `/time-off/requests/${refusedRequest.id}`, 404)
  step('GET on the deleted request returns 404')

  const deletedAllocation = await ok('DELETE', `/time-off/allocations/${refusable.id}`)
  assert.equal(deletedAllocation.id, refusable.id)
  step('DELETE /time-off/allocations/:id removes a refused allocation')

  await fails('GET', '/time-off/types/not-a-uuid', 400)
  step('GET /time-off/types/:id rejects a malformed uuid 400')

  await fails('GET', '/time-off/types/00000000-0000-4000-8000-000000000000', 404)
  step('GET /time-off/types/:id returns 404 for an unknown id')

  console.log('\nFinal snapshot')
  const final = await ok('GET', '/time-off')
  assert.ok(final.types.some(item => item.id === dayType.id), 'the snapshot reflects the created type')
  assert.ok(final.requests.some(item => item.id === hourly.id), 'the snapshot reflects the auto-approved request')
  step('GET /time-off reflects everything the test created')

  await cleanup()
  await removeUser()
  console.log(`\nAll ${passed} checks passed. E2E records and the ${USER.email} account removed.`)
}

main()
  .catch(error => {
    console.error(`\nFAILED: ${error.message}`)
    process.exitCode = 1
    // Tear down even on failure, so a broken run leaves no admin account behind.
    return cleanup()
      .then(removeUser)
      .catch(() => undefined)
  })
  .finally(() => pool.end())
