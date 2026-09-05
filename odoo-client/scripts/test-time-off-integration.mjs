import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = file => readFileSync(root + file, 'utf8')
const initializer = read('features/hr/data-stores-initializer.tsx')
assert.match(initializer, /useTimeOffStore.getState\(\).initialize\(\{ types: \[\], allocations: \[\], requests: \[\] \}\)/)
assert.doesNotMatch(initializer, /demo|faker|mock/i)
assert.match(
  read('features/employees/components/employee-fields.tsx'),
  /<EmployeeTimeOffLinks employeeId=\{employee.id\}/
)
const links = read('features/time-off/components/employee-links.tsx')
assert.match(links, /\/time-off\/requests\?employee=/)
assert.match(links, /\/time-off\/allocations\?employee=/)
assert.match(links, /encodeURIComponent\(employeeId\)/)
for (const section of ['types', 'allocations', 'requests']) {
  assert.match(read(`app/(app)/time-off/${section}/page.tsx`), new RegExp(`@/features/time-off/${section}`))
  assert.match(read(`app/(app)/time-off/${section}/[id]/page.tsx`), new RegExp(`@/features/time-off/${section}/detail`))
  assert.match(read(`features/time-off/${section}/index.tsx`), /<TimeOffListPage/)
  assert.match(read(`features/time-off/${section}/index.tsx`), /<RecordPanel/)
  assert.match(read(`features/time-off/${section}/detail.tsx`), /<TimeOffDetailPage/)
}
const shell = read('features/time-off/components/list-page.tsx')
for (const pattern of [
  /useRecordsTable/,
  /<RecordViewBar/,
  /<RecordsTable/,
  /getPrePaginationRowModel/,
  /<DataConnectionNotice/,
]) {
  assert.match(shell, pattern)
}
for (const section of ['allocations', 'requests']) {
  assert.match(read(`features/time-off/${section}/index.tsx`), /useQueryState/)
  assert.match(read(`features/time-off/${section}/editor.tsx`), /DatePicker/)
  assert.match(read(`features/time-off/${section}/editor.tsx`), /Choice/)
}
assert.match(read('features/time-off/requests/editor.tsx'), /TimePicker/)
assert.match(
  read('features/time-off/requests/balance-summary.tsx'),
  /allocation.validTo && allocation.validTo </,
  'ongoing allocations must not appear expired'
)
for (const file of readdirSync(root + 'features/time-off', { recursive: true }).filter(name => /\.tsx?$/.test(name))) {
  const source = read('features/time-off/' + file)
  assert.doesNotMatch(source, /from ['"](?:zod|zustand|react-hook-form|nuqs)['"]/, file + ' must use native state')
  assert.doesNotMatch(source, /type=['"](?:date|time|datetime-local)['"]/, file + ' must use themed date/time pickers')
}
console.log(
  'PASS: Time Off routes, empty-state initialization, employee links, searchable shared lists, filtered export and themed native-state forms.'
)
