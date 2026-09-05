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
  // Type-only tightening at the generic React context boundary; no rendered UI changes.
  .replaceAll('createContext<KanbanContextProps<any>>', 'createContext<KanbanContextProps<unknown>>')
  .replaceAll('value={contextValue}', 'value={contextValue as KanbanContextProps<unknown>}')

function verifyFile(relative) {
  assert.equal(readFileSync(path.join(feature, relative), 'utf8'),
    adapt(readFileSync(path.join(warehouse, 'src', relative), 'utf8')), `Source drift: ${relative}`)
  verified++
}
function verifyDirectory(relative) {
  for (const entry of readdirSync(path.join(feature, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name)
    if (entry.isDirectory()) verifyDirectory(file)
    else verifyFile(file)
  }
}
verifyDirectory('views/apps/opportunities')
verifyDirectory('components/kanban')
verifyFile('components/ui/kanban.tsx')
const route = readFileSync(path.join(project, 'app/(app)/kanban/page.tsx'), 'utf8')
assert.ok(route.includes("<OpportunitiesView defaultView='kanban' />"))
const employees = readFileSync(path.join(project, 'app/(app)/employees/page.tsx'), 'utf8')
assert.ok(employees.includes('@/features/employees'))
assert.ok(!employees.includes('OpportunitiesView'))
console.log(`PASS: ${verified} original opportunity/Kanban UI files match; Kanban and People routes stay separate.`)
