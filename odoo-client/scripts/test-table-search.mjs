import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createTable, getCoreRowModel, getFilteredRowModel, getPaginationRowModel } from '@tanstack/react-table'

const require = createRequire(import.meta.url)
const root = fileURLToPath(new URL('../', import.meta.url))
const cache = new Map()
const inputRef = { current: null }

// Load the real components, replacing only browser UI primitives and the React hook host.
// Filtering, pagination, JSX structure and all event handlers execute their actual code.
function load(file) {
  if (cache.has(file)) return cache.get(file)
  const { outputText } = ts.transpileModule(readFileSync(root + file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  })
  const module = { exports: {} }
  const imports = name => {
    if (name === 'react') return { ...require(name), useRef: () => inputRef }
    if (name.endsWith('/adapters/query-state')) return {}
    if (name.endsWith('/lib/utils')) return { cn: (...values) => values.filter(Boolean).join(' ') }
    if (name.includes('/components/ui/')) {
      return new Proxy({}, { get: (_, key) => key === '__esModule' ? true : key })
    }
    if (name.startsWith('@/')) {
      const extension = name.includes('/components/') ? '.tsx' : '.ts'
      return load(name.slice(2) + extension)
    }
    return require(name)
  }
  new Function('require', 'module', 'exports', outputText)(imports, module, module.exports)
  cache.set(file, module.exports)
  return module.exports
}

function find(element, predicate) {
  if (!element || typeof element !== 'object') return undefined
  if (predicate(element)) return element
  const children = [element.props?.children].flat(Infinity)
  for (const child of children) {
    const found = find(child, predicate)
    if (found) return found
  }
}

const RecordViewBar = load('features/nexacrm/components/data-table/record-view-bar.tsx').default
const { TableSearch } = load('features/nexacrm/components/data-table/table-search.tsx')
const data = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  name: [1, 7, 10].includes(index) ? `Ada ${index}` : `Employee ${index}`,
  department: index === 7 ? 'Finance' : 'Engineering'
}))
const table = createTable({
  data,
  columns: [{ accessorKey: 'name' }, { accessorKey: 'department', filterFn: 'equalsString' }],
  globalFilterFn: 'includesString',
  getCoreRowModel: getCoreRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  getPaginationRowModel: getPaginationRowModel(),
  // Explicit reset must work even in tables which disable automatic page resets.
  autoResetPageIndex: false,
  onStateChange: updater => table.setOptions(previous => ({
    ...previous,
    state: typeof updater === 'function' ? updater(previous.state) : updater
  }))
})
table.setOptions(previous => ({ ...previous, state: { ...table.initialState, pagination: { pageIndex: 2, pageSize: 2 } } }))

const renderBar = (props = {}) => RecordViewBar({ table, viewName: 'Employees', count: table.getFilteredRowModel().rows.length, ...props })
const searchControl = () => {
  const element = find(renderBar(), node => node.type === TableSearch)
  assert.ok(element, 'Search is visible outside the filter dropdown')
  return TableSearch(element.props)
}
const search = value => find(searchControl(), node => node.type === 'Input').props.onChange({ target: { value } })
const visibleIds = () => table.getRowModel().rows.map(row => row.original.id)
const filteredCount = () => table.getFilteredRowModel().rows.length

assert.deepEqual(visibleIds(), [4, 5])
search('aDa')
assert.equal(table.getState().pagination.pageIndex, 0, 'Typing resets a later page')
assert.equal(filteredCount(), 3, 'Search includes matching rows from every original page')
assert.deepEqual(visibleIds(), [1, 7])
assert.equal(table.getPageCount(), 2)
assert.equal(find(renderBar(), node => node.props?.['data-testid'] === 'record-count').props.children[1], 3)
table.nextPage()
assert.deepEqual(visibleIds(), [10], 'Pagination applies after filtering')

search('missing')
assert.equal(filteredCount(), 0)
assert.deepEqual(visibleIds(), [])
assert.equal(table.getState().pagination.pageIndex, 0)
let focused = false
inputRef.current = { focus: () => { focused = true } }
find(searchControl(), node => node.props?.['aria-label'] === 'Clear search').props.onClick()
assert.equal(table.getState().globalFilter, '')
assert.equal(filteredCount(), 12)
assert.equal(table.getPageCount(), 6)
assert.deepEqual(visibleIds(), [0, 1])
assert.equal(focused, true, 'Clearing returns focus to search')
assert.equal(find(searchControl(), node => node.props?.['aria-label'] === 'Clear search'), undefined)

table.getColumn('department').setFilterValue('Engineering')
search('Ada')
assert.equal(filteredCount(), 2, 'Search combines with existing column filters')
assert.deepEqual(visibleIds(), [1, 10])
assert.ok(find(renderBar({ showFilter: false }), node => node.type === TableSearch), 'Search also works without a filter button')
assert.equal(find(renderBar({ showSearch: false }), node => node.type === TableSearch), undefined)

console.log('PASS: real search/clear callbacks, page reset, case-insensitive cross-page results, filtered counts, pagination, empty results, existing filters and search visibility.')
