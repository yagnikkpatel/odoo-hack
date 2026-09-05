/**
 * Seeds a realistic Time Off dataset so the module has something to show.
 *
 * Goes through the real API rather than raw SQL, so every record gets its
 * server-computed duration, charges, consumptions and decision history — the
 * same path the UI uses.
 *
 *   npm run dev            # in another terminal
 *   node scripts/seed-time-off.cjs
 *
 * Idempotent: it skips seeding if leave types already exist. Pass --reset to
 * wipe the three time off tables first.
 */
const assert = require('node:assert/strict')
const { Pool } = require('pg')
require('dotenv').config({ quiet: true })

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:4000/api').replace(/\/$/, '')
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let token = ''

async function api(method, path, body) {
  const headers = { Accept: 'application/json', Authorization: `Bearer ${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  }).catch(error => {
    throw new Error(`Cannot reach ${BASE_URL} — is the server running? (${error.message})`)
  })
  const payload = await response.json().catch(() => null)
  if (payload?.success !== true) {
    throw new Error(`${method} ${path} failed ${response.status}: ${payload?.message ?? 'unknown error'}`)
  }
  return payload.data
}

/** A Monday in the near past, so seeded leave spans both past and future. */
function monday(offsetDays = 0) {
  const date = new Date()
  date.setUTCHours(12, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - (((date.getUTCDay() + 6) % 7)) + offsetDays)
  return date.toISOString().slice(0, 10)
}

const TYPES = [
  { name: 'Annual Leave', code: 'ANNUAL', unit: 'days', requiresAllocation: true, approval: 'manager', payroll: 'paid', active: true, description: 'Paid annual holiday, drawn from a yearly allocation.' },
  { name: 'Sick Leave', code: 'SICK', unit: 'days', requiresAllocation: false, approval: 'manager', payroll: 'paid', active: true, description: 'Paid sick days. No allocation required.' },
  { name: 'Unpaid Leave', code: 'UNPAID', unit: 'days', requiresAllocation: false, approval: 'manager', payroll: 'unpaid', active: true, description: 'Approved absence without pay.' },
  { name: 'Time Off In Lieu', code: 'TOIL', unit: 'hours', requiresAllocation: false, approval: 'none', payroll: 'unpaid', active: true, description: 'Hourly time off in lieu of overtime. Auto-approved.' }
]

async function main() {
  assert.ok(ADMIN.email && ADMIN.password, 'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env')

  if (process.argv.includes('--reset')) {
    await pool.query('DELETE FROM time_off_requests')
    await pool.query('DELETE FROM time_off_allocations')
    await pool.query('DELETE FROM time_off_types')
    console.log('Cleared existing time off data.\n')
  }

  const existing = await pool.query('SELECT COUNT(*)::int c FROM time_off_types')
  if (existing.rows[0].c > 0) {
    console.log(`${existing.rows[0].c} leave types already exist — nothing to do. Use --reset to reseed.`)
    return
  }

  const employees = await pool.query(
    `SELECT u.id, u.name FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.status = 'active' AND r.name = 'employee' ORDER BY u.created_at LIMIT 6`
  )
  assert.ok(employees.rows.length >= 3, 'need at least three active employees to seed against')

  token = (await api('POST', '/auth/login', ADMIN)).accessToken
  console.log(`Signed in as ${ADMIN.email}\n`)

  const types = {}
  for (const input of TYPES) {
    const type = await api('POST', '/time-off/types', input)
    types[type.code] = type
    console.log(`  type       ${type.name} (${type.code})`)
  }

  // Every employee gets an approved annual allowance for the current year.
  const allocations = {}
  for (const employee of employees.rows) {
    const allocation = await api('POST', '/time-off/allocations', {
      employeeId: employee.id,
      typeId: types.ANNUAL.id,
      amount: 20,
      validFrom: `${new Date().getUTCFullYear()}-01-01`,
      validTo: '',
      note: 'Annual entitlement'
    })
    allocations[employee.id] = await api('POST', `/time-off/allocations/${allocation.id}/approve`)
    console.log(`  allocation ${employee.name}: 20 days annual leave (approved)`)
  }

  // A spread of statuses so every badge and filter in the UI has something to show.
  const [first, second, third, fourth, fifth, sixth] = employees.rows
  const plans = [
    { employee: first, type: 'ANNUAL', start: monday(7), end: monday(9), reason: 'Family holiday', then: 'approve' },
    { employee: second, type: 'ANNUAL', start: monday(14), end: monday(18), reason: 'Wedding in the family', then: null },
    { employee: third, type: 'SICK', start: monday(-7), end: monday(-6), reason: 'Flu', then: 'approve' },
    { employee: first, type: 'SICK', start: monday(21), end: monday(21), reason: 'Medical appointment', then: 'refuse' },
    { employee: second ?? first, type: 'TOIL', start: monday(28), end: monday(28), startTime: '10:00', endTime: '13:00', reason: 'Overtime in lieu', then: null },
    { employee: fourth ?? first, type: 'UNPAID', start: monday(35), end: monday(37), reason: 'Personal travel', then: null },
    { employee: fifth ?? second, type: 'ANNUAL', start: monday(42), end: monday(44), reason: 'Short break', then: 'cancel' },
    { employee: sixth ?? third, type: 'ANNUAL', start: monday(49), end: monday(51), reason: 'Diwali visit', then: 'approve' }
  ]

  for (const plan of plans) {
    if (!plan.employee) continue
    const request = await api('POST', '/time-off/requests', {
      employeeId: plan.employee.id,
      typeId: types[plan.type].id,
      startDate: plan.start,
      endDate: plan.end,
      startTime: plan.startTime ?? '',
      endTime: plan.endTime ?? '',
      reason: plan.reason
    })
    let status = request.status
    if (plan.then === 'approve') status = (await api('POST', `/time-off/requests/${request.id}/approve`)).status
    if (plan.then === 'refuse') {
      status = (await api('POST', `/time-off/requests/${request.id}/refuse`, { reason: 'Insufficient cover that week.' })).status
    }
    if (plan.then === 'cancel') {
      await api('POST', `/time-off/requests/${request.id}/approve`)
      status = (await api('POST', `/time-off/requests/${request.id}/cancel`, { reason: 'Plans changed.' })).status
    }
    console.log(`  request    ${plan.employee.name}: ${types[plan.type].name} ${plan.start}${plan.end !== plan.start ? ` to ${plan.end}` : ''} (${status})`)
  }

  const snapshot = await api('GET', '/time-off')
  console.log(
    `\nSeeded ${snapshot.types.length} types, ${snapshot.allocations.length} allocations, ${snapshot.requests.length} requests.`
  )
}

main()
  .catch(error => {
    console.error(`\nFAILED: ${error.message}`)
    process.exitCode = 1
  })
  .finally(() => pool.end())
