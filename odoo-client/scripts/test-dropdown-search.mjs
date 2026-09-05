import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = file => readFileSync(root + file, 'utf8')
const compiled = ts.transpileModule(read('features/nexacrm/lib/option-search.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const loaded = { exports: {} }
new Function('module', 'exports', compiled)(loaded, loaded.exports)
const { filterOptions, SEARCHABLE_OPTION_THRESHOLD } = loaded.exports
const options = Object.freeze([
  { value: '1', label: 'Ada Lovelace' },
  { value: '2', label: 'José García' },
  { value: '3', label: 'Ada Lovelace' },
  { value: '4', label: 'Not assigned' },
])
const label = option => option.label
assert.equal(SEARCHABLE_OPTION_THRESHOLD, 8)
assert.deepEqual(filterOptions(options, '', label), options)
assert.deepEqual(filterOptions(options, '  ', label), options)
assert.deepEqual(filterOptions(options, 'ada', label).map(option => option.value), ['1', '3'], 'duplicate labels retain distinct IDs')
assert.deepEqual(filterOptions(options, '  LOVELACE ada ', label).map(option => option.value), ['1', '3'])
assert.equal(filterOptions(options, 'Jose garcia', label)[0].value, '2')
assert.equal(filterOptions(options, 'not assigned', label)[0].value, '4')
assert.deepEqual(filterOptions(options, 'missing', label), [])
assert.deepEqual(filterOptions([], 'ada', label), [])
assert.equal(options.length, 4, 'search must not mutate options')
const select = read('features/nexacrm/components/ui/searchable-select.tsx')
assert.match(select, /options.length >= SEARCHABLE_OPTION_THRESHOLD/)
assert.match(select, /initialFocus=\{inputRef\}/)
assert.match(select, /aria-controls=\{open \? popupId : undefined\}/)
assert.match(select, /id=\{popupId\}/)
assert.match(select, /value=\{option.value\}/)
assert.match(select, /onChange\(option.value\)/)
assert.match(select, /setQuery\(''\)/)
assert.ok(select.indexOf('<CommandInput') < select.indexOf('<CommandList'), 'search must sit above the scrollable list')
for (const file of ['features/hr/components/form.tsx', 'features/nexacrm/components/record/record-field.tsx', 'features/nexacrm/components/data-table/import-dialog.tsx']) assert.match(read(file), /SearchableSelect/)
assert.match(read('features/contracts/components/contract-editor.tsx'), /features\/hr\/components\/form/)
for (const file of ['features/nexacrm/components/data-table/record-view-bar.tsx', 'features/nexacrm/components/data-table/data-table-view-options.tsx', 'features/nexacrm/components/calendar/record-calendar.tsx', 'features/attendance/record-calendar.tsx']) assert.match(read(file), /SearchableMenuSection/)
assert.match(read('features/nexacrm/components/ui/searchable-menu-section.tsx'), /event.key === 'Escape'/)
assert.match(read('features/nexacrm/components/ui/searchable-menu-section.tsx'), /ArrowDown/)
assert.match(read('features/nexacrm/components/data-table/data-table-view-options.tsx'), /disabled=\{searching \|\| !sortableIds.includes\(column.id\)\}/)
console.log('PASS: long-list threshold, case/accent/multi-word filtering, stable duplicate IDs, empty results, reset/selection contracts and all dropdown integration points.')
