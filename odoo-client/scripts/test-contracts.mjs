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
  let file = path.resolve(root, relative)
  if (!fs.existsSync(file)) file += '.ts'
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const localRequire = spec => spec.startsWith('@/')
    ? load(spec.slice(2))
    : spec.startsWith('.')
      ? load(path.resolve(path.dirname(file), spec))
      : requirePackage(spec)
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const employeeId = '11111111-1111-4111-8111-111111111111'
const contractId = '22222222-2222-4222-8222-222222222222'
const base = {
  employeeId,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  wage: 85000,
  status: 'running'
}

const { validateContract, formatWage, contractTitle } = load('features/contracts/types')
assert.equal(validateContract(base), null)
for (const change of [
  { employeeId: '' },
  { startDate: '2026-02-30' },
  { endDate: '' },
  { endDate: '2025-12-31' },
  { wage: 0 },
  { wage: -1 },
  { wage: Number.NaN },
  { wage: 10_000_000_000 },
  { status: 'draft' }
]) {
  assert.ok(validateContract({ ...base, ...change }), JSON.stringify(change))
}
assert.match(formatWage(base.wage), /85,000/)
assert.equal(contractTitle({ employeeName: 'Ada Lovelace' }), 'Ada Lovelace contract')

const record = {
  ...base,
  id: contractId,
  employeeName: '=Ada Lovelace',
  employeeEmail: '+ada@example.test',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z'
}
const { mapContract, mapPagination } = load('features/contracts/contract-mapper')
assert.deepEqual(mapContract(record), record)
const avatarUrl = 'https://images.example.invalid/employee.png'
assert.equal(mapContract({ ...record, employeeAvatar: avatarUrl }).employeeAvatar, avatarUrl)
for (const employeeAvatar of [null, '', 123, {}, 'not-a-url', 'javascript:alert(1)', 'data:image/png;base64,invalid']) {
  assert.deepEqual(mapContract({ ...record, employeeAvatar }), record)
}
assert.match(read('features/contracts/table/columns.tsx'), /src=\{row.original.employeeAvatar\}/)
assert.match(read('features/contracts/components/contract-fields.tsx'), /src=\{contract.employeeAvatar\}/)
assert.deepEqual(mapPagination({ total: 1, limit: 15, offset: 0, hasMore: false }), {
  total: 1,
  limit: 15,
  offset: 0,
  hasMore: false
})
assert.throws(() => mapContract({ ...record, status: 'active' }), /invalid status/)
assert.throws(() => mapContract({ ...record, wage: '85000' }), /invalid wage/)

const { contractCsvRows } = load('features/contracts/csv')
const exported = contractCsvRows([record])[0]
assert.equal(exported.Employee, "'=Ada Lovelace")
assert.equal(exported['Employee email'], "'+ada@example.test")
assert.equal(exported.Status, 'Running')

const store = read('features/contracts/store.ts')
assert.doesNotMatch(store, /crypto\.randomUUID|DATA_API_CONNECTED|getActorId/)
assert.match(store, /contractService\.createContract/)
assert.match(store, /contractService\.updateContract/)
assert.match(store, /contractService\.deleteContract/)

const bridge = read('features/contracts/server.ts')
assert.match(bridge, /SESSION_COOKIE_NAME/)
assert.match(bridge, /Authorization: `Bearer \$\{token\}`/)
assert.match(bridge, /checkSameOrigin/)
assert.match(bridge, /cache: 'no-store'/)
assert.match(read('app/api/contracts/route.ts'), /handleContractRequest/)
assert.match(read('app/api/contracts/[id]/route.ts'), /PATCH/)
assert.match(read('features/contracts/components/contract-editor.tsx'), /<DatePicker/)
assert.match(read('features/contracts/components/employee-contracts-link.tsx'), /\/contracts\?employee=/)

console.log('PASS: backend-shaped contract validation, response mapping, CSV safety, authenticated API bridge, async CRUD wiring, and no runtime mock generation.')
