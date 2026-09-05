import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const cache = new Map()
const read = relative => fs.readFileSync(path.resolve(root, relative), 'utf8')

function load(relative) {
  const file = path.resolve(root, relative)
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = specifier => {
    if (specifier.startsWith('@/')) return load(specifier.slice(2) + '.ts')
    if (specifier.startsWith('.')) return load(path.resolve(path.dirname(file), specifier + '.ts'))
    return requirePackage(specifier)
  }
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const { employeeListQuery, employeeQueriesMatch, lastEmployeePage } = load('features/employees/table/query.ts')
assert.deepEqual(employeeListQuery({ pageIndex: 0, pageSize: 15 }, '', []), { limit: 15, offset: 0 })
const query = employeeListQuery({ pageIndex: 2, pageSize: 25 }, '  engineer  ', [
  { id: 'department', value: ' Product ' },
  { id: 'role', value: 'employee' },
  { id: 'status', value: 'active' },
])
assert.deepEqual(query, { limit: 25, offset: 50, search: 'engineer', department: 'Product', role: 'employee' })
assert.equal(employeeQueriesMatch(query, { ...query }), true)
assert.equal(employeeQueriesMatch(query, { ...query, offset: 0 }), false)
assert.equal(employeeQueriesMatch(query, { ...query, search: 'another search' }), false)
assert.equal(employeeQueriesMatch(query, { ...query, department: undefined }), false)
assert.deepEqual(employeeListQuery({ pageIndex: 0, pageSize: 10 }, '   ', [
  { id: 'department', value: null },
  { id: 'role', value: ['employee'] },
]), { limit: 10, offset: 0 })
assert.equal(lastEmployeePage(0, 15), 0)
assert.equal(lastEmployeePage(15, 15), 0)
assert.equal(lastEmployeePage(16, 15), 1)
assert.equal(lastEmployeePage(45, 15), 2)

const { employeeStats } = load('features/employees/stats.ts')
assert.deepEqual(employeeStats({}), { total: 0, departments: 0, withManager: 0, withoutManager: 0 })
assert.deepEqual(employeeStats({ total: null, departments: null }), {
  total: 0, departments: 0, withManager: 0, withoutManager: 0,
})
assert.deepEqual(employeeStats({ total: 123, departments: 8, withManager: 90, withoutManager: 33 }), {
  total: 123, departments: 8, withManager: 90, withoutManager: 33,
})

const { employeeCsvRows } = load('features/employees/csv.ts')
// Test fixtures are confined to this script and never seed application state.
const rows = employeeCsvRows([{
  id: 'account-id',
  firstName: 'Ignored alias',
  lastName: '',
  name: '=formula',
  email: 'person@example.test',
  companyName: '  +formula',
  department: 'Engineering',
  role: 'employee',
  status: 'active',
}])
assert.equal(rows.length, 1)
assert.equal(rows[0].Name, "'=formula")
assert.equal(rows[0].Company, "'  +formula")
assert.equal(rows[0].Manager, 'Not set')
assert.equal(rows[0].Phone, 'Not set')
assert.equal(rows[0].Role, 'Employee')
assert.equal(Object.hasOwn(rows[0], 'Employment type'), false)
assert.deepEqual(employeeCsvRows([]), [])

const hook = read('features/employees/table/use-employees-table.ts')
assert.match(hook, /manualPagination: true/)
assert.match(hook, /manualFiltering: true/)
assert.match(hook, /enableSorting: false/)
assert.match(hook, /rowCount: serverPagination.total/)
assert.doesNotMatch(hook, /getFilteredRowModel|getPaginationRowModel|useCompaniesStore/)
assert.match(read('features/employees/grid/index.tsx'), /<EmployeePagination/)
assert.match(read('features/employees/table/employees-table.tsx'), /<EmployeePagination/)
assert.match(read('features/employees/table/table-toolbar.tsx'), /Export current page to CSV/)
assert.match(read('features/employees/index.tsx'), /if \(!canReadAll\)/)
assert.match(read('features/employees/stats-cards.tsx'), /state.summary/)
const companyColumn = read('features/employees/table/columns.tsx').split("accessorKey: 'companyName'")[1].split("accessorKey: 'department'")[0]
assert.match(companyColumn, /<EmployeeCompany employee=\{row.original\}/, 'The company column must show the shared logo and name component')
assert.match(read('features/employees/components/employee-company.tsx'), /<AvatarImage src=\{employee.companyImage\}/)
assert.match(read('features/employees/components/employee-company.tsx'), /aspect-auto h-auto w-auto max-h-6 max-w-16 rounded-sm object-contain/, 'Company logos must keep their proportions with subtly rounded corners, not a circular crop')
assert.doesNotMatch(read('features/employees/csv.ts'), /ImportField|ParsedRow|createEmployeeRowParser/)
for (const file of [
  'index.tsx', 'csv.ts', 'stats.ts', 'stats-cards.tsx', 'table/columns.tsx',
  'table/table-toolbar.tsx', 'table/employees-table.tsx', 'grid/index.tsx', 'grid/employee-card.tsx',
]) {
  assert.doesNotMatch(read('features/employees/' + file), /—|crypto.randomUUID|faker|demo directory/)
}

console.log('PASS: employee directory queries, server pagination, aggregate KPIs, safe CSV export, role-aware entry, and real-data UI guards.')
