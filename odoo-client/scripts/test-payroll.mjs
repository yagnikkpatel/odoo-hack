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
  const file = path.resolve(root, relative)
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
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
const { usePayrollStore } = load('features/payroll/store.ts')
const { useEmployeesStore } = load('features/employees/store.ts')
const { payrollContractInputs } = load('features/payroll/contract-input.ts')
const { useUsersStore } = load('features/nexacrm/store/use-users-store.ts')
const { useCurrentActorStore } = load('features/nexacrm/store/use-current-actor-store.ts')
useEmployeesStore.setState({employees:[employee]}); payrollContractInputs.splice(0, payrollContractInputs.length, contract)
useUsersStore.setState({users:[{id:'actor',role:'admin'}]}); useCurrentActorStore.setState({actorId:'actor'})
const store = () => usePayrollStore.getState()
assert.deepEqual(store().rules, [], 'runtime does not supply salary rules')
assert.deepEqual(store().structures, [], 'runtime does not supply salary structures')
usePayrollStore.setState({ rules: structuredClone(DEFAULT_RULES), structures: structuredClone(DEFAULT_STRUCTURES) })
assert.equal(store().createPayrun({...run, employeeIds:[]}).ok, false)
let result = store().createPayrun(run); assert.equal(result.ok, true); const id = result.id
assert.equal(store().validatePayrun(id).ok,false)
assert.equal(store().computePayrun(id).ok,true)
assert.equal(store().validatePayrun(id).ok,false,'bank blocks validation')
store().setBankDetails('emp1','12345678'); store().computePayrun(id)
assert.equal(store().validatePayrun(id).ok,true)
const snapshot = JSON.stringify(store().payslips)
payrollContractInputs.splice(0, payrollContractInputs.length, {...contract,wage:999999})
assert.equal(store().computePayrun(id).ok,false); assert.equal(store().removePayrun(id).ok,false)
assert.equal(JSON.stringify(store().payslips),snapshot,'validated history unchanged by contract edits')
assert.equal(store().markPaid(id).ok,true); assert.equal(store().markPaid(id).ok,false)
useUsersStore.setState({users:[{id:'actor',role:'hr_payroll_user'}]})
assert.equal(store().removePayrun(id).ok,false,'payroll user cannot delete')
assert.equal(store().saveRule(DEFAULT_RULES[0]).ok,false,'payroll user configuration read only')
useUsersStore.setState({users:[{id:'actor',role:'employee'}]})
assert.equal(store().createPayrun(run).ok,false,'employee cannot process payroll')
console.log('Payroll tests passed: safe arithmetic, ordered rules, contract coverage, unpaid leave, warning gates, history locks and role guards.')
useUsersStore.setState({users:[{id:'actor',role:'admin'}]})
const rulesBefore = store().rules
const structuresBefore = store().structures
const structure = store().structures[0]
assert.equal(store().saveStructure({...structure,description:'Changed'},structure.id,[{...store().rules[0],sequence:20}]).ok,false)
assert.equal(store().rules,rulesBefore,'invalid combined save does not mutate rules')
assert.equal(store().structures,structuresBefore,'invalid combined save does not mutate structures')
assert.equal(store().saveStructure({...structure,description:'Changed'},structure.id,[{...store().rules[0],sequence:5}]).ok,true)
assert.equal(store().rules[0].sequence,5); assert.equal(store().structures[0].description,'Changed')
useUsersStore.setState({users:[{id:'actor',role:'hr_payroll_user'}]})
assert.equal(store().saveStructure(structure,structure.id).ok,false)
useUsersStore.setState({users:[{id:'actor',role:'admin'}]})
const created = store().createPayrun({...run,name:'Editable'}); assert.equal(created.ok,true)
assert.equal(store().computePayrun(created.id).ok,true)
assert.equal(store().updatePayrun(created.id,{...run,name:'Revised'}).ok,true)
assert.equal(store().payruns.find(item=>item.id===created.id).status,'draft')
assert.equal(store().payslips.some(item=>item.payrunId===created.id),false)
assert.equal(store().updatePayrun(id,{...run,name:'Historical edit'}).ok,false)
console.log('Atomic configuration saves and payrun edits passed.')
const annual = computePayslip(run,'emp1',DEFAULT_STRUCTURES[0],DEFAULT_RULES,{...context,contracts:[{...contract,wagePeriod:'year',wage:360000}]})
assert.equal(annual.basic,30000)
const hourly = computePayslip(run,'emp1',DEFAULT_STRUCTURES[0],DEFAULT_RULES,{...context,contracts:[{...contract,wagePeriod:'hour',wage:100}],attendance:[{employeeId:'emp1',checkIn:'2026-09-01T09:00',checkOut:'2026-09-01T18:00',breakMinutes:60}]})
assert.equal(hourly.basic,800); assert.equal(hourly.workedHours,8); assert.equal(hourly.workedDays,1)
const missingCheckout = computePayslip(run,'emp1',DEFAULT_STRUCTURES[0],DEFAULT_RULES,{...context,contracts:[{...contract,wagePeriod:'hour'}],attendance:[{employeeId:'emp1',checkIn:'2026-09-01T09:00',breakMinutes:0}]})
assert.ok(missingCheckout.warnings.some(warning=>warning.code==='attendance'&&warning.blocking))
console.log('Annual and hourly wage calculations passed.')
