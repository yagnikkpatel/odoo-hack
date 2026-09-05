import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const project = fileURLToPath(new URL('../', import.meta.url))
const warehouse = path.resolve(process.argv[2] ?? path.join(project,
  '../../odoo-hack-final-26/component-warehouse/shadcn-nextjs-nexacrm-app-template-1.0.0'))
const feature = path.join(project, 'features/nexacrm')
let verified = 0
const adapt = source => source.replaceAll("'@/", "'@/features/nexacrm/")
  .replaceAll("from 'zustand'", "from '@/features/nexacrm/adapters/native-store'")
  .replaceAll("from 'nuqs'", "from '@/features/nexacrm/adapters/query-state'")
  .replaceAll('/people/', '/employees/').replaceAll("'/people'", "'/employees'")

function verify(relative) {
  for (const entry of readdirSync(path.join(feature, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name)
    if (entry.isDirectory()) { verify(file); continue }
    // This non-UI parser deliberately replaces Zod and is covered by adapter tests.
    if (file.endsWith('/person-import.ts')) continue
    assert.equal(readFileSync(path.join(feature, file), 'utf8'),
      adapt(readFileSync(path.join(warehouse, 'src', file), 'utf8')), `Source drift: ${file}`)
    verified++
  }
}
for (const relative of ['views/apps/people', 'components/data-table', 'components/calendar', 'components/record']) verify(relative)
assert.ok(readFileSync(path.join(project, 'app/(app)/employees/page.tsx'), 'utf8')
  .includes('@/features/employees'))
console.log(`PASS: ${verified} preserved People/supporting UI files match warehouse source; Employees uses its isolated HR adaptation.`)
