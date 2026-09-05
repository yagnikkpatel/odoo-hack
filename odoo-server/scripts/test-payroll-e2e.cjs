/**
 * End-to-end test for the Payroll API against a REAL running server, database
 * and Redis:
 *
 *   npm run docker:up && npm run migrate && npm run dev
 *   node scripts/test-payroll-e2e.cjs
 *
 * It signs in as the seeded admin, creates a throwaway employee (payroll-e2e@test.com)
 * with a contract, and walks a payrun from creation to paid: compute, blocked
 * validation (missing bank details), bank fix, validation, mark paid, PDF, send.
 * Every record it creates is prefixed E2E and removed at the end.
 */
const assert = require('node:assert/strict')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')
require('dotenv').config({ quiet: true })

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://localhost:4000/api').replace(/\/$/, '')
const ADMIN = { email: process.env.SEED_ADMIN_EMAIL, password: process.env.SEED_ADMIN_PASSWORD }
const EMPLOYEE = { name: 'E2E Payroll Employee', email: 'payroll-e2e@test.com', password: 'test@1234' }
const pool = new Pool({ connectionString: process.env.DATABASE_URL })
let token = ''
let passed = 0

function step(name) {
  passed += 1
  console.log(`  ${String(passed).padStart(2, ' ')}. ${name}`)
}

async function api(method, path, body, raw = false) {
  const headers = { Accept: raw ? '*/*' : 'application/json', Authorization: `Bearer ${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    .catch(error => { throw new Error(`Cannot reach ${BASE_URL} — is the server running? (${error.message})`) })
  if (raw) return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) }
  return { status: response.status, payload: await response.json().catch(() => null) }
}

async function ok(method, path, body) {
  const { status, payload } = await api(method, path, body)
  assert.equal(payload?.success, true, `${method} ${path} -> ${status} ${payload?.message ?? ''}`)
  return payload.data
}

async function fails(method, path, expected, body) {
  const { status, payload } = await api(method, path, body)
  assert.equal(status, expected, `${method} ${path} expected ${expected}, got ${status}: ${payload?.message ?? ''}`)
  return payload?.message ?? ''
}

async function upsertEmployee() {
  const hash = await bcrypt.hash(EMPLOYEE.password, 10)
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, name, role_id, status)
     SELECT $1, $2, $3, r.id, 'active' FROM roles r WHERE r.name = 'employee'
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name
     RETURNING id`,
    [EMPLOYEE.email, hash, EMPLOYEE.name]
  )
  const id = result.rows[0].id
  await pool.query(
    `INSERT INTO employee_profiles (user_id, job_position, department, contact, working_schedule, company_name, work_location)
     VALUES ($1, 'E2E engineer', 'E2E Department', '', 'Standard 40h', 'PeoplePay360', 'Remote')
     ON CONFLICT (user_id) DO NOTHING`,
    [id]
  )
  return id
}

async function cleanup(employeeId) {
  await pool.query(`DELETE FROM payruns WHERE name LIKE 'E2E%'`)
  await pool.query(`DELETE FROM salary_structures WHERE name LIKE 'E2E%'`)
  await pool.query(`DELETE FROM salary_rules WHERE code LIKE 'E2E%'`)
  if (employeeId) {
    await pool.query(`DELETE FROM attendances WHERE employee_id = $1`, [employeeId])
    await pool.query(`DELETE FROM time_off_requests WHERE employee_id = $1`, [employeeId])
    await pool.query(`DELETE FROM employee_bank_details WHERE employee_id = $1`, [employeeId])
    await pool.query(`DELETE FROM contracts WHERE employee_id = $1`, [employeeId])
    await pool.query(`DELETE FROM employee_profiles WHERE user_id = $1`, [employeeId])
    await pool.query(`DELETE FROM users WHERE id = $1`, [employeeId])
  }
}

async function main() {
  assert.ok(ADMIN.email && ADMIN.password, 'SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env')
  const employeeId = await upsertEmployee()
  await cleanup(employeeId).catch(() => {})
  const restoredId = await upsertEmployee()

  try {
    token = (await ok('POST', '/auth/login', ADMIN)).accessToken
    step('admin signed in')

    // Configuration -------------------------------------------------------
    const snapshot = await ok('GET', '/payroll')
    assert.ok(snapshot.rules.length >= 10, 'default Indian rules seeded')
    const regular = snapshot.structures.find(s => s.name === 'Regular Salary (India)')
    assert.ok(regular && regular.ruleIds.length === 10, 'Regular Salary (India) has 10 rules')
    step('snapshot lists seeded rules and structures')

    const basic = await ok('POST', '/payroll/rules', { name: 'E2E basic', code: 'E2E_BASIC', category: 'basic', sequence: 10, method: 'formula', formula: 'WAGE * PAID_DAYS / PERIOD_DAYS' })
    const hra = await ok('POST', '/payroll/rules', { name: 'E2E HRA', code: 'E2E_HRA', category: 'allowance', sequence: 20, method: 'percentage', percentage: 40, base: 'E2E_BASIC' })
    const pf = await ok('POST', '/payroll/rules', { name: 'E2E PF', code: 'E2E_PF', category: 'deduction', sequence: 30, method: 'formula', formula: '0.12 * MIN(E2E_BASIC, 15000)' })
    const net = await ok('POST', '/payroll/rules', { name: 'E2E net', code: 'E2E_NET', category: 'net', sequence: 40, method: 'formula', formula: 'E2E_BASIC + E2E_HRA - E2E_PF' })
    step('rules created (formula, percentage, MIN)')

    assert.match(await fails('POST', '/payroll/rules', 400, { name: 'Bad', code: 'WAGE', category: 'basic', method: 'fixed', amount: 1 }), /reserved/i)
    assert.match(await fails('POST', '/payroll/rules', 400, { name: 'Bad', code: 'E2E_BAD', category: 'basic', method: 'formula', formula: 'E2E_BASIC; process.exit()' }), /numbers, known codes/i)
    assert.equal(await fails('POST', '/payroll/rules', 409, { name: 'Dup', code: 'E2E_BASIC', category: 'basic', method: 'fixed', amount: 1 }), 'A salary rule already uses this code')
    step('rule validation rejects reserved codes, unsafe formulas and duplicates')

    assert.match(await fails('POST', '/payroll/structures', 400, { name: 'E2E broken', ruleIds: [net.id] }), /Unknown or unavailable formula code/)
    const structure = await ok('POST', '/payroll/structures', { name: 'E2E Structure', description: 'e2e', ruleIds: [basic.id, hra.id, pf.id, net.id] })
    assert.equal(structure.ruleCount, 4)
    step('structure rejects unresolved dependencies and accepts an ordered set')

    // Contract + eligibility ---------------------------------------------
    const period = { startDate: '2026-08-01', endDate: '2026-08-31' }
    await ok('POST', '/contracts', { employeeId: restoredId, startDate: '2026-01-01', endDate: '2026-12-31', wage: 60000, salaryStructureId: structure.id, employmentType: 'full_time' })
    const eligible = (await ok('GET', `/payroll/payruns/eligible?structureId=${structure.id}&startDate=${period.startDate}&endDate=${period.endDate}`)).employees
    const me = eligible.find(e => e.employeeId === restoredId)
    assert.ok(me && me.structureMatches && !me.hasBankDetails, 'employee eligible with matching structure and no bank details')
    step('contract with structure makes the employee eligible for the period')

    // Two approved unpaid leave days inside the period (LOP).
    await pool.query(
      `INSERT INTO time_off_requests (employee_id, type_id, start_date, end_date, start_time, end_time, reason, unit, duration, charges, consumptions, history, status)
       SELECT $1, t.id, '2026-08-10', '2026-08-11', '', '', 'E2E LOP', 'days', 2,
              '[{"date":"2026-08-10","amount":1},{"date":"2026-08-11","amount":1}]'::jsonb, '[]'::jsonb, '[]'::jsonb, 'approved'
       FROM time_off_types t WHERE t.payroll = 'unpaid' AND t.unit = 'days' LIMIT 1`,
      [restoredId]
    )
    await pool.query(
      `INSERT INTO attendances (employee_id, attendance_date, check_in, check_out, status)
       VALUES ($1, '2026-08-03', '2026-08-03 09:25+05:30', '2026-08-03 18:00+05:30', 'present'),
              ($1, '2026-08-04', '2026-08-04 09:00+05:30', NULL, 'incomplete')`,
      [restoredId]
    )

    // Payrun lifecycle ----------------------------------------------------
    assert.match(await fails('POST', '/payroll/payruns', 400, { name: 'E2E bad', structureId: structure.id, startDate: '2027-01-01', endDate: '2027-01-31', employeeIds: [restoredId] }), /single contract covering the full period/)
    const created = await ok('POST', '/payroll/payruns', { name: 'E2E August payroll', structureId: structure.id, ...period, employeeIds: [restoredId] })
    assert.equal(created.status, 'draft')
    assert.equal(created.payslipCount, 1)
    step('payrun created in draft with one draft payslip')

    assert.match(await fails('POST', `/payroll/payruns/${created.id}/validate`, 409), /Compute this payrun/)
    const computed = await ok('POST', `/payroll/payruns/${created.id}/compute`)
    const slip = computed.payslips[0]
    assert.equal(computed.payrun.status, 'computed')
    assert.equal(slip.periodDays, 31)
    assert.equal(slip.unpaidDays, 2)
    assert.equal(slip.paidDays, 29)
    assert.equal(slip.workedDays, 1)
    // WAGE 60000 * 29/31 = 56129.03; HRA 40% = 22451.61; PF = 12% of min(basic,15000) = 1800
    assert.equal(slip.basic, 56129.03)
    assert.equal(slip.allowances, 22451.61)
    assert.equal(slip.deductions, 1800)
    assert.equal(slip.net, 76780.64)
    assert.ok(slip.warnings.some(w => w.code === 'bank' && w.blocking), 'missing bank details is a blocking warning')
    assert.ok(slip.warnings.some(w => w.code === 'attendance' && !w.blocking), 'missing check-out is a non-blocking warning')
    step('compute applies contract wage, loss of pay, rule sequence and warnings')

    assert.match(await fails('POST', `/payroll/payruns/${created.id}/validate`, 409), /blocking warning/)
    step('validation is blocked by missing bank details')

    assert.match(await fails('PUT', `/payroll/bank-details/${restoredId}`, 400, { accountNumber: '123', ifsc: 'bad' }), /accountNumber|ifsc/)
    const bank = await ok('PUT', `/payroll/bank-details/${restoredId}`, { accountHolder: EMPLOYEE.name, accountNumber: '123456789012', ifsc: 'HDFC0001234', bankName: 'HDFC Bank', pan: 'ABCDE1234F', uan: '' })
    assert.equal(bank.ifsc, 'HDFC0001234')
    step('bank details validated and saved')

    const validated = await ok('POST', `/payroll/payruns/${created.id}/validate`)
    assert.equal(validated.payrun.status, 'validated')
    assert.equal(validated.payslips[0].status, 'validated')
    assert.equal(validated.payslips[0].bankSnapshot.accountNumberLast4, '9012')
    step('validation recomputes, clears the warning and locks the batch')

    assert.match(await fails('POST', `/payroll/payruns/${created.id}/compute`, 409), /immutable history/)
    assert.match(await fails('DELETE', `/payroll/payruns/${created.id}`, 409), /immutable history/)
    step('validated payroll cannot be recomputed or deleted')

    const duplicate = await ok('POST', '/payroll/payruns', { name: 'E2E duplicate', structureId: structure.id, startDate: '2026-08-15', endDate: '2026-08-20', employeeIds: [restoredId] })
    const duplicateComputed = await ok('POST', `/payroll/payruns/${duplicate.id}/compute`)
    assert.ok(duplicateComputed.payslips[0].warnings.some(w => w.code === 'duplicate' && w.blocking), 'overlapping payslip flagged as duplicate')
    await ok('DELETE', `/payroll/payruns/${duplicate.id}`)
    step('overlapping period is flagged as a duplicate payslip; draft can be deleted')

    const pdf = await api('GET', `/payroll/payslips/${slip.id}/pdf`, undefined, true)
    assert.equal(pdf.status, 200)
    assert.equal(pdf.headers.get('content-type'), 'application/pdf')
    assert.equal(pdf.bytes.subarray(0, 4).toString(), '%PDF')
    step('payslip PDF renders')

    const sent = await ok('POST', `/payroll/payruns/${created.id}/send`, {})
    assert.ok(['smtp', 'log'].includes(sent.transport))
    assert.equal(sent.sent.length, 1)
    step(`send payslips reports transport=${sent.transport}`)

    const paid = await ok('POST', `/payroll/payruns/${created.id}/mark-paid`)
    assert.equal(paid.payrun.status, 'paid')
    assert.ok(paid.payrun.paidAt)
    step('payrun marked paid')

    const list = (await ok('GET', `/payroll/payslips?employeeId=${restoredId}`)).payslips
    assert.equal(list.length, 1)
    assert.equal(list[0].status, 'paid')
    step('payslips list filters by employee')

    const dashboard = await ok('GET', `/payroll/dashboard?from=2026-08-01&to=2026-08-31&department=${encodeURIComponent('E2E Department')}`)
    assert.equal(dashboard.kpis.netPaid, 76780.64)
    assert.equal(dashboard.kpis.payslipsGenerated, 1)
    assert.equal(dashboard.kpis.headcount, 1)
    assert.equal(dashboard.timeOff.unpaidDays, 2)
    assert.equal(dashboard.attendance.present, 1)
    assert.equal(dashboard.attendance.late, 1)
    assert.equal(dashboard.attendance.missingCheckouts, 1)
    assert.ok(dashboard.costByDepartment.some(row => row.department === 'E2E Department' && row.net === 76780.64))
    assert.ok(dashboard.monthlyTrend.some(row => row.month === '2026-08' && row.net === 76780.64))
    step('dashboard aggregates payroll, attendance and leave for the filters')

    assert.match(await fails('DELETE', `/payroll/structures/${structure.id}`, 409), /referenced by a contract or payrun/)
    assert.match(await fails('DELETE', `/payroll/rules/${basic.id}`, 409), /Remove this rule/)
    step('referenced structures and rules cannot be deleted')

    console.log(`\nAll ${passed} payroll checks passed.`)
  } finally {
    await cleanup(restoredId)
    await pool.end()
  }
}

main().catch(error => {
  console.error('\nFAILED:', error.message)
  process.exit(1)
})
