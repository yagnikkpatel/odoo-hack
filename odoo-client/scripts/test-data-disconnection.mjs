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
  if (!fs.existsSync(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx'
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  const localRequire = spec =>
    spec.startsWith('@/')
      ? load(spec.slice(2))
      : spec.startsWith('.')
        ? load(path.resolve(path.dirname(file), spec))
        : requirePackage(spec)
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

// Unlike reducer unit tests, this loads the actual production connection flag.
const { DATA_API_CONNECTED } = load('features/hr/data-availability.ts')
assert.equal(DATA_API_CONNECTED, false)
const { useEmployeesStore } = load('features/employees/store.ts')
const { useContractsStore } = load('features/contracts/store.ts')
const { useAttendanceStore } = load('features/attendance/store.ts')
const { useSchedulesStore } = load('features/working-schedules/store.ts')
const { useTimeOffStore } = load('features/time-off/store.ts')
const { usePayrollStore } = load('features/payroll/store.ts')
const { initializeEmptyDataStores } = load('features/hr/data-stores-initializer.tsx')
initializeEmptyDataStores()
const stores = [
  useEmployeesStore,
  useContractsStore,
  useAttendanceStore,
  useSchedulesStore,
  useTimeOffStore,
  usePayrollStore
]
for (const store of stores.slice(1, 5))
  assert.equal(store.getState().hasHydrated, true, 'empty data must resolve loading')
const snapshots = stores.map(store => store.getState())
initializeEmptyDataStores()
stores.forEach((store, i) => assert.equal(store.getState(), snapshots[i], 'repeated initialization is idempotent'))
assert.deepEqual(useEmployeesStore.getState().employees, [])
assert.equal(useEmployeesStore.getState().hasHydrated, false, 'Employees loads from its API, not the empty-store initializer')
assert.deepEqual(useContractsStore.getState().contracts, [])
assert.deepEqual(useAttendanceStore.getState().records, [])
assert.deepEqual(useSchedulesStore.getState().schedules, [])
assert.deepEqual(useSchedulesStore.getState().assignments, {})
for (const key of ['types', 'allocations', 'requests']) assert.deepEqual(useTimeOffStore.getState()[key], [])
for (const key of ['rules', 'structures', 'payruns', 'payslips']) assert.deepEqual(usePayrollStore.getState()[key], [])
assert.deepEqual(usePayrollStore.getState().bankDetails, {})

assert.throws(() => useContractsStore.getState().remove('unavailable'), /Data connection pending/)
assert.throws(() => useAttendanceStore.getState().remove('unavailable'), /Data connection pending/)
for (const [store, methods] of [
  [useContractsStore, ['save']],
  [useAttendanceStore, ['save', 'checkOut']],
  [useSchedulesStore, ['save', 'assign', 'remove']],
  [
    useTimeOffStore,
    [
      'saveType',
      'removeType',
      'saveAllocation',
      'approveAllocation',
      'refuseAllocation',
      'removeAllocation',
      'saveRequest',
      'approveRequest',
      'refuseRequest',
      'cancelRequest',
      'removeRequest'
    ]
  ],
  [
    usePayrollStore,
    [
      'saveRule',
      'removeRule',
      'saveStructure',
      'removeStructure',
      'createPayrun',
      'updatePayrun',
      'removePayslip',
      'computePayrun',
      'validatePayrun',
      'markPaid',
      'removePayrun',
      'setBankDetails'
    ]
  ]
]) {
  for (const method of methods) {
    const result = store.getState()[method]()
    assert.equal(result.ok, false, `${method} cannot claim success without a data API`)
    assert.match(result.error, /Data connection pending/)
  }
}
stores.forEach((store, i) => assert.equal(store.getState(), snapshots[i], 'blocked writes must not change data'))

// A verified admin still cannot mutate disconnected payroll through role-specific entry points.
const { useUsersStore } = load('features/nexacrm/store/use-users-store.ts')
const { useCurrentActorStore } = load('features/nexacrm/store/use-current-actor-store.ts')
const { getPayrollPermissions } = load('features/payroll/permissions.ts')
useUsersStore.setState({ users: [{ id: 'test-admin', role: 'admin' }] })
useCurrentActorStore.setState({ actorId: 'test-admin' })
const permissions = getPayrollPermissions()
assert.equal(permissions.canRead, true)
for (const key of ['canProcess', 'canConfigure', 'canDelete']) assert.equal(permissions[key], false)
assert.equal(usePayrollStore.getState().createPayrun().ok, false)
for (const file of [
  'features/contracts/demo-data.ts',
  'features/attendance/hydrator.tsx',
  'features/time-off/hydrator.tsx',
  'features/payroll/demo-data.ts'
]) {
  assert.equal(fs.existsSync(path.join(root, file)), false, `${file} must not return as a production seed`)
}
console.log(
  'PASS: production HR stores initialize empty, loading resolves, all disconnected mutations fail atomically, and admin payroll writes remain blocked.'
)
