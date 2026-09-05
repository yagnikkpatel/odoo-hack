const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

// Isolated SQL and cache tests. No live database, Redis, or account writes.
const modules = new Map()
const queries = []
const cached = new Map()
const versions = new Map([['contract-list', 0], ['employee-list', 0]])
const record = {
  id: '22222222-2222-4222-8222-222222222222',
  employeeId: '11111111-1111-4111-8111-111111111111',
  employeeName: 'Fixture Employee',
  employeeEmail: 'fixture@example.invalid',
  employeeAvatar: 'https://images.example.invalid/original.png',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  wage: 100,
  status: 'running',
}
const mocks = {
  '../lib/db': {
    pool: {
      async query(sql, values) {
        queries.push({ sql, values })
        if (sql.includes('COUNT(*) OVER()')) return { rows: [{ ...record, total: 1 }] }
        return { rows: [{ ...record }] }
      },
    },
  },
  '../lib/cache': {
    getCacheVersion: async namespace => versions.get(namespace) || 0,
    bumpCacheVersion: async namespace => versions.set(namespace, (versions.get(namespace) || 0) + 1),
    getCached: async key => cached.get(key) || null,
    setCached: async (key, value) => cached.set(key, value),
    invalidateCache: async keys => keys.forEach(key => cached.delete(key)),
  },
}

function load(relative) {
  let file = path.resolve(__dirname, '../src', relative)
  if (!file.endsWith('.ts')) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const module = { exports: {} }
  modules.set(file, module)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name))
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(localRequire, module, module.exports)
  return module.exports
}

async function main() {
  const repository = load('repositories/contract.repository')
  const input = { employeeId: record.employeeId, startDate: record.startDate, endDate: record.endDate, wage: record.wage, status: record.status }
  const query = { limit: 15, offset: 0 }
  await repository.findAllContracts(query)
  await repository.findContractById(record.id)
  await repository.insertContract(input)
  await repository.updateContractById(record.id, { wage: 200 })
  assert.equal(queries.length, 4)
  for (const { sql } of queries) {
    assert.match(sql, /p.employee_image_url AS "employeeAvatar"/)
    assert.match(sql, /LEFT JOIN employee_profiles p ON p.user_id = c.employee_id/, 'Missing profiles must not hide contracts')
    assert.doesNotMatch(sql, /password|image_public_id/)
  }

  const service = load('services/contract.service')
  const firstList = await service.listContracts(query)
  const firstDetail = await service.getContract(record.id)
  const beforeCacheHit = queries.length
  await service.listContracts(query)
  await service.getContract(record.id)
  assert.equal(queries.length, beforeCacheHit, 'Repeated reads should use the cache')
  assert.equal(firstList.contracts[0].employeeAvatar, record.employeeAvatar)
  assert.equal(firstDetail.employeeAvatar, record.employeeAvatar)

  record.employeeAvatar = 'https://images.example.invalid/replacement.png'
  versions.set('employee-list', 1)
  assert.equal((await service.listContracts(query)).contracts[0].employeeAvatar, record.employeeAvatar)
  assert.equal((await service.getContract(record.id)).employeeAvatar, record.employeeAvatar)

  record.employeeAvatar = null
  versions.set('employee-list', 2)
  assert.equal((await service.listContracts(query)).contracts[0].employeeAvatar, null)
  assert.equal((await service.getContract(record.id)).employeeAvatar, null)

  record.wage = 200
  await service.updateContract(record.id, { wage: 200 })
  assert.equal((await service.getContract(record.id)).wage, 200)
  assert.equal((await service.listContracts(query)).contracts[0].wage, 200)
  console.log('PASS: contract photo SQL on list/detail/create/update, missing-profile-safe joins, and cache refresh after photo replacement/removal or contract updates.')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
