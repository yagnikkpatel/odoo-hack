/**
 * Seeds a demo payroll dataset on top of the existing employees:
 * contracts with salary structures, Indian bank details, August/September
 * attendance, one approved unpaid leave, a paid July and August payrun and a
 * computed September draft.
 *
 *   npm run dev            # in another terminal
 *   node scripts/seed-payroll.cjs
 *
 * Idempotent: skips when a "* 2026 payroll" payrun exists. Pass --reset to
 * delete payruns, payslips and bank details first (contracts are kept).
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
  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    .catch(error => { throw new Error(`Cannot reach ${BASE_URL} — is the server running? (${error.message})`) })
  const payload = await response.json().catch(() => null)
  if (payload?.success !== true) throw new Error(`${method} ${path} failed ${response.status}: ${payload?.message ?? 'unknown error'}`)
  return payload.data
}

const WAGES = { Engineering: 85000, Design: 70000, Finance: 65000, 'Human Resources': 55000, Operations: 45000, MedTech: 60000 }
const BANKS = [
  ['HDFC0001234', 'HDFC Bank'], ['ICIC0004567', 'ICICI Bank'], ['SBIN0007890', 'State Bank of India'],
  ['AXIS0002345', 'Axis Bank'], ['KKBK0005678', 'Kotak Mahindra Bank'], ['UTIB0003456', 'Axis Bank']
]
const pad = n => String(n).padStart(2, '0')
const ymd = d => d.toISOString().slice(0, 10)

function weekdays(year, month) {
  const days = []
  for (let day = 1; day <= 31; day++) {
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCMonth() !== month - 1) break
    if (date.getUTCDay() !== 0 && date.getUTCDay() !== 6) days.push(ymd(date))
  }
  return days
}

async function seedAttendance(employees, dates) {
  let inserted = 0
  for (const [index, employee] of employees.entries()) {
    for (const [dayIndex, date] of dates.entries()) {
      const seed = (index * 7 + dayIndex) % 11
      let checkIn = `${date} 09:${pad(seed * 3)}:00+05:30`
      let checkOut = `${date} 18:${pad(seed * 2)}:00+05:30`
      let status = 'present'
      let overtime = seed === 9 ? 1.5 : 0
      if (seed === 4) checkIn = `${date} 09:45:00+05:30`           // late
      if (seed === 7) { checkOut = null; status = 'incomplete' }   // missing check-out
      if (seed === 10) { checkIn = null; checkOut = null; status = 'absent' }
      const result = await pool.query(
        `INSERT INTO attendances (employee_id, attendance_date, check_in, check_out, status, overtime_hours)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (employee_id, attendance_date) DO NOTHING`,
        [employee.id, date, checkIn, checkOut, status, overtime]
      )
      inserted += result.rowCount
    }
  }
  return inserted
}

async function runPayrun(name, structure, period, employeeIds, finalize) {
  const eligible = (await api('GET', `/payroll/payruns/eligible?structureId=${structure.id}&startDate=${period.startDate}&endDate=${period.endDate}`)).employees
  const ids = eligible.filter(e => e.structureMatches).map(e => e.employeeId).filter(id => employeeIds.includes(id))
  if (!ids.length) { console.log(`  skip       ${name}: no eligible employees`); return }
  const payrun = await api('POST', '/payroll/payruns', { name, structureId: structure.id, ...period, employeeIds: ids })
  let detail = await api('POST', `/payroll/payruns/${payrun.id}/compute`)
  if (finalize) {
    try {
      detail = await api('POST', `/payroll/payruns/${payrun.id}/validate`)
      detail = await api('POST', `/payroll/payruns/${payrun.id}/mark-paid`)
    } catch (error) {
      console.log(`  warning    ${name}: ${error.message}`)
    }
  }
  const net = detail.payslips.reduce((sum, slip) => sum + slip.net, 0)
  console.log(`  payrun     ${name}: ${detail.payslips.length} payslips, ${detail.payrun.status}, net Rs ${net.toLocaleString('en-IN')}`)
}

async function main() {
  assert.ok(ADMIN.email && ADMIN.password, 'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env')

  if (process.argv.includes('--reset')) {
    await pool.query('DELETE FROM payruns')
    await pool.query('DELETE FROM employee_bank_details')
    console.log('Cleared payruns, payslips and bank details.\n')
  }

  const existing = await pool.query(`SELECT COUNT(*)::int c FROM payruns WHERE name LIKE '% 2026 payroll'`)
  if (existing.rows[0].c > 0) {
    console.log(`${existing.rows[0].c} seeded payruns already exist — nothing to do. Use --reset to reseed.`)
    return
  }

  token = (await api('POST', '/auth/login', ADMIN)).accessToken
  console.log(`Signed in as ${ADMIN.email}\n`)

  const snapshot = await api('GET', '/payroll')
  const regular = snapshot.structures.find(s => s.name === 'Regular Salary (India)')
  const consultant = snapshot.structures.find(s => s.name === 'Consultant (TDS 194J)')
  assert.ok(regular && consultant, 'default salary structures missing — run npm run migrate')

  const employees = (await pool.query(
    `SELECT u.id, u.name, u.email, COALESCE(p.department, '') department
     FROM users u JOIN roles r ON r.id = u.role_id LEFT JOIN employee_profiles p ON p.user_id = u.id
     WHERE u.status = 'active' AND r.name = 'employee' ORDER BY u.created_at`
  )).rows
  assert.ok(employees.length >= 3, 'need at least three active employees to seed against')

  // Contracts: one per employee, covering the whole year, with a structure.
  const contracts = (await api('GET', '/contracts?limit=100')).contracts
  for (const [index, employee] of employees.entries()) {
    const isConsultant = employee.department === 'Operations'
    const current = contracts.find(c => c.employeeId === employee.id && c.status === 'running')
    const structure = isConsultant ? consultant : regular
    const employmentType = isConsultant ? 'contract' : index % 5 === 3 ? 'part_time' : 'full_time'
    const wage = WAGES[employee.department] ?? 50000
    if (current) {
      const patch = {}
      if (current.startDate > '2026-01-01') patch.startDate = '2026-01-01'
      if (!current.salaryStructureId) patch.salaryStructureId = structure.id
      if (Object.keys(patch).length) await api('PATCH', `/contracts/${current.id}`, patch)
      console.log(`  contract   ${employee.name}: kept (${Object.keys(patch).join(', ') || 'unchanged'})`)
    } else {
      await api('POST', '/contracts', { employeeId: employee.id, startDate: '2026-01-01', endDate: '2027-12-31', wage, status: 'running', salaryStructureId: structure.id, employmentType })
      console.log(`  contract   ${employee.name}: Rs ${wage.toLocaleString('en-IN')}/month, ${structure.name}, ${employmentType}`)
    }
  }

  // Bank details for everyone except the last two, so the demo has warnings to fix.
  const withBank = employees.slice(0, Math.max(3, employees.length - 2))
  for (const [index, employee] of withBank.entries()) {
    const [ifsc, bankName] = BANKS[index % BANKS.length]
    await api('PUT', `/payroll/bank-details/${employee.id}`, {
      accountHolder: employee.name, accountNumber: String(100200300000 + index * 7919), ifsc, bankName,
      pan: `ABCPE${String(1000 + index)}${'FGHJKLMNPQ'[index % 10]}`, uan: String(100000000000 + index * 13)
    })
  }
  console.log(`  bank       ${withBank.length} of ${employees.length} employees have bank details\n`)

  // Attendance for July, August and September (up to today).
  const today = ymd(new Date())
  const dates = [...weekdays(2026, 7), ...weekdays(2026, 8), ...weekdays(2026, 9).filter(d => d < today)]
  const inserted = await seedAttendance(employees, dates)
  console.log(`  attendance ${inserted} records added (${dates.length} working days)`)

  // One approved unpaid leave in August so loss of pay shows on a payslip.
  const types = (await api('GET', '/time-off/types')).types
  const unpaid = types.find(t => t.payroll === 'unpaid' && t.unit === 'days' && t.active)
  if (unpaid) {
    const employee = employees[Math.min(2, employees.length - 1)]
    try {
      const request = await api('POST', '/time-off/requests', { employeeId: employee.id, typeId: unpaid.id, startDate: '2026-08-17', endDate: '2026-08-18', startTime: '', endTime: '', reason: 'Personal travel (LOP)' })
      await api('POST', `/time-off/requests/${request.id}/approve`)
      console.log(`  leave      ${employee.name}: 2 days unpaid leave approved (17-18 Aug)\n`)
    } catch (error) {
      console.log(`  leave      skipped: ${error.message}\n`)
    }
  }

  const bankIds = withBank.map(e => e.id)
  const allIds = employees.map(e => e.id)
  await runPayrun('July 2026 payroll', regular, { startDate: '2026-07-01', endDate: '2026-07-31' }, bankIds, true)
  await runPayrun('August 2026 payroll', regular, { startDate: '2026-08-01', endDate: '2026-08-31' }, bankIds, true)
  await runPayrun('August 2026 consultants', consultant, { startDate: '2026-08-01', endDate: '2026-08-31' }, allIds, true)
  await runPayrun('September 2026 payroll', regular, { startDate: '2026-09-01', endDate: '2026-09-30' }, allIds, false)

  console.log('\nDone. Open /payroll in the client.')
}

main()
  .catch(error => { console.error('\nFAILED:', error.message); process.exitCode = 1 })
  .finally(() => pool.end())
