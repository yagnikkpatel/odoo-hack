import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const cache = new Map()
function load(relative) {
  let file = path.resolve(root, relative)
  if (!fs.existsSync(file) && file.endsWith('.ts') && fs.existsSync(file + 'x')) file += 'x'
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  const localRequire = spec => spec === '@/features/hr/data-availability' ? load('scripts/fixtures/data-connection.ts') : spec.startsWith('@/') ? load(spec.slice(2) + '.ts')
    : spec.startsWith('.') ? load(path.resolve(path.dirname(file), spec + '.ts')) : requirePackage(spec)
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const { evaluateFormula, computePayslip, periodContract, validateRules } = load('features/payroll/engine.ts')
const { DEFAULT_RULES, DEFAULT_STRUCTURES } = load('scripts/fixtures/payroll.ts')
assert.equal(evaluateFormula('(WAGE + 20) * 0.5 - -2', { WAGE: 100 }), 62)
for (const formula of ['process.exit()', 'WAGE.constructor', '1/0', '1 +', '1 2', '(1+2', 'UNKNOWN', '1;alert(2)']) assert.throws(() => evaluateFormula(formula, { WAGE: 100 }), formula)
assert.match(validateRules([{ ...DEFAULT_RULES[0], formula: 'NET' }]), /unavailable/)
const employee = { id: 'emp1', firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.test', status: 'active' }
const contract = { id: 'ctr1', name: 'Contract', employeeId: 'emp1', startDate: '2026-01-01', state: 'active', wage: 30000, currency: 'INR', wagePeriod: 'month', department: 'Engineering', salaryStructure: 'Regular salary' }
const run = { id: 'run1', name: 'September', employeeIds: ['emp1'], structureId: DEFAULT_STRUCTURES[0].id, structureName: 'Regular salary', startDate: '2026-09-01', endDate: '2026-09-30', status: 'draft', warnings: [] }
const context = { employees: [employee], contracts: [contract], attendance: [], schedules: [], assignments: {}, bankDetails: { emp1: '12345678' }, existingPayslips: [] }
let slip = computePayslip(run, 'emp1', DEFAULT_STRUCTURES[0], DEFAULT_RULES, context)
assert.equal(slip.basic, 30000); assert.equal(slip.allowances, 6000); assert.equal(slip.deductions, 1500); assert.equal(slip.net, 34500)
assert.equal(slip.warnings.filter(warning => warning.blocking).length, 0)
slip = computePayslip(run, 'emp1', DEFAULT_STRUCTURES[0], DEFAULT_RULES, { ...context, timeOff: { types: [{ id: 'unpaid', payroll: 'unpaid' }], requests: [{ employeeId: 'emp1', typeId: 'unpaid', status: 'approved', unit: 'days', charges: [{date: '2026-09-02', amount: 2}, { date: '2026-10-01', amount: 10 }] }] } })
assert.equal(slip.net, 32500, 'only approved unpaid charges inside period reduce net')
assert.throws(() => periodContract([{...contract,startDate:'2026-09-02'}], 'emp1', run.startDate, run.endDate), /full period/)
assert.throws(() => periodContract([contract,{...contract,id:'ctr2'}], 'emp1', run.startDate, run.endDate), /multiple/)
slip = computePayslip(run, 'emp1', DEFAULT_STRUCTURES[0], DEFAULT_RULES, { ...context, bankDetails: {}, existingPayslips: [{ ...slip, payrunId: 'other' }] })
assert.ok(slip.warnings.some(warning => warning.code === 'bank' && warning.blocking)); assert.ok(slip.warnings.some(warning => warning.code === 'duplicate' && warning.blocking))
// The store now delegates lifecycle and validation to the backend.
// Exercise its async requests, failures and permission boundaries separately.
await import('./test-payroll-connection.mjs')
console.log('Payroll calculation tests passed: safe arithmetic, ordered rules, contract coverage, unpaid leave and warning gates.')
const annual = computePayslip(run,'emp1',DEFAULT_STRUCTURES[0],DEFAULT_RULES,{...context,contracts:[{...contract,wagePeriod:'year',wage:360000}]})
assert.equal(annual.basic,30000)
const hourly = computePayslip(run,'emp1',DEFAULT_STRUCTURES[0],DEFAULT_RULES,{...context,contracts:[{...contract,wagePeriod:'hour',wage:100}],attendance:[{employeeId:'emp1',checkIn:'2026-09-01T09:00',checkOut:'2026-09-01T18:00',breakMinutes:60}]})
assert.equal(hourly.basic,800); assert.equal(hourly.workedHours,8); assert.equal(hourly.workedDays,1)
const missingCheckout = computePayslip(run,'emp1',DEFAULT_STRUCTURES[0],DEFAULT_RULES,{...context,contracts:[{...contract,wagePeriod:'hour'}],attendance:[{employeeId:'emp1',checkIn:'2026-09-01T09:00',breakMinutes:0}]})
assert.ok(missingCheckout.warnings.some(warning=>warning.code==='attendance'&&warning.blocking))
console.log('Annual and hourly wage calculations passed.')
