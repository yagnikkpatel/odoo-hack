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
  const localRequire = spec => spec.startsWith('@/') ? load(spec.slice(2) + '.ts')
    : spec.startsWith('.') ? load(path.resolve(path.dirname(file), spec + '.ts')) : requirePackage(spec)
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const { payrollReport } = load('features/payroll/reporting/data.ts')
const { payrollPermissions } = load('features/payroll/permissions.ts')
assert.equal(payrollPermissions('hr_payroll_manager').canConfigure,true)
assert.equal(payrollPermissions('hr_payroll_user').canDelete,false)
assert.equal(payrollPermissions('hr_payroll_user').canProcess,true)
assert.equal(payrollPermissions('hr_manager').canReport,false)
assert.equal(payrollPermissions('hr_manager').canRead,false)
assert.equal(payrollPermissions('employee').canRead,false)
assert.equal(payrollPermissions('admin').canDelete,true)
assert.equal(payrollPermissions('manager').canRead,false, 'old CRM role must not grant HR access')
const filter = {from:'2026-09-01',to:'2026-09-04',department:'all',employmentType:'all',currency:'INR'}
const empty = {employees:[],contracts:[],attendance:[],schedules:[],assignments:{},leave:{types:[],allocations:[],requests:[]},payruns:[],payslips:[]}
const none = payrollReport(empty,filter,'2026-09-05')
assert.equal(none.netPaid,0);assert.equal(none.average,0);assert.equal(none.attendance.coverage,null);assert.deepEqual(none.trends,[])
const employee = {id:'e1',department:'Engineering',employmentType:'full-time'}
const contract = {id:'c1',employeeId:'e1',state:'active',startDate:'2026-01-01',department:'Engineering',workingSchedule:'s1',currency:'INR'}
const schedule = {id:'s1',name:'Weekdays',slots:[0,1,2,3,4].map(day=>({day,start:'09:00',end:'18:00',breakMinutes:60}))}
const attendance = [{employeeId:'e1',checkIn:'2026-09-01T09:30',checkOut:'2026-09-01T19:00',breakMinutes:60,corrections:[{}]},{employeeId:'e1',checkIn:'2026-09-03T09:00',breakMinutes:0,corrections:[]}]
const slip = {id:'p1',payrunId:'r1',employeeId:'deleted-employee',department:'Old department',employmentType:'contract',currency:'INR',startDate:filter.from,endDate:filter.to,status:'paid',net:1000}
const payrun = {id:'r1',name:'Historical',employeeIds:['deleted-employee'],startDate:filter.from,endDate:filter.to,status:'paid',warnings:[{employeeId:'deleted-employee',code:'email',message:'Missing email'}]}
const source = {...empty,employees:[employee],contracts:[contract],schedules:[schedule],attendance,payslips:[slip,{...slip,id:'p2',payrunId:'r2',currency:'USD',net:9000},{...slip,id:'p3',payrunId:'r3',status:'computed',net:600}],payruns:[payrun,{...payrun,id:'r2'},{...payrun,id:'r3',status:'computed'}],leave:{types:[{id:'days',unit:'days',requiresAllocation:true,payroll:'paid'},{id:'hours',unit:'hours',requiresAllocation:true,payroll:'unpaid'}],allocations:[{id:'a1',employeeId:'e1',typeId:'days',amount:10,status:'approved',validFrom:'2026-01-01',validTo:'2026-12-31'},{id:'a2',employeeId:'e1',typeId:'hours',amount:16,status:'approved',validFrom:'2026-01-01',validTo:'2026-12-31'}],requests:[{id:'l1',employeeId:'e1',typeId:'days',unit:'days',status:'approved',startDate:'2026-09-02',endDate:'2026-10-02',duration:3,charges:[{date:'2026-09-02',amount:1},{date:'2026-10-02',amount:2}],consumptions:[{date:'2026-09-02',amount:1,allocationId:'a1'},{date:'2026-10-02',amount:2,allocationId:'a1'}]},{id:'l2',employeeId:'e1',typeId:'hours',unit:'hours',status:'approved',startDate:'2026-09-04',endDate:'2026-09-04',duration:4,charges:[{date:'2026-09-04',amount:4}],consumptions:[{date:'2026-09-04',amount:4,allocationId:'a2'}]},{id:'l3',employeeId:'e1',typeId:'days',unit:'days',status:'pending',startDate:'2026-09-04',endDate:'2026-09-04',duration:1,charges:[{date:'2026-09-04',amount:1}],consumptions:[]}]}}
const report = payrollReport(source,filter,'2026-09-05')
assert.equal(report.netPaid,1000,'never mix currencies or unpaid/computed amounts');assert.equal(report.average,1000);assert.equal(report.slips.length,2)
assert.deepEqual(report.trends,[{month:'2026-09',net:1000}]);assert.equal(report.runs.length,2,'exclude USD run')
assert.equal(report.approvedDays,1);assert.equal(report.approvedHours,4);assert.equal(report.unpaidDays,0);assert.equal(report.unpaidHours,4);assert.equal(report.pending,1)
assert.equal(report.balanceDays,9,'historical balance excludes future approved consumption');assert.equal(report.balanceHours,12)
assert.equal(report.attendance.present,2);assert.equal(report.attendance.late,1);assert.equal(report.attendance.missing,1);assert.equal(report.attendance.manualEdits,1);assert.equal(report.attendance.overtimeMinutes,30)
assert.equal(report.attendance.scheduled,4);assert.equal(report.attendance.covered,2);assert.equal(report.attendance.absent,1);assert.equal(report.attendance.coverage,50)
const historical = payrollReport(source,{...filter,department:'Old department',employmentType:'contract'},'2026-09-05')
assert.equal(historical.netPaid,1000);assert.equal(historical.runs.length,2);assert.equal(historical.warnings.length,2);assert.equal(historical.employees.length,0)
assert.equal(payrollReport(source,{...filter,currency:'USD'},'2026-09-05').netPaid,9000)
const future = payrollReport({...source,attendance:[...attendance,{employeeId:'e1',checkIn:'2026-09-04T09:00',checkOut:'2026-09-04T18:00',breakMinutes:60,corrections:[]}]},filter,'2026-09-03')
assert.equal(future.attendance.present,2,'attendance excludes records after today')
assert.equal(payrollReport({...source,contracts:[{...contract,startDate:'2026-09-02'}]},filter,'2026-09-05').noContract,1,'partial contract flags attention')
console.log('Payroll report tests passed: empty states, snapshot filters, currencies, paid trends, attendance, leave units, period balances and role names.')
