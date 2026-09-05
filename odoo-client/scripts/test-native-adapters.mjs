import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Load the pure TypeScript adapters with the project's existing compiler; no test dependency.
const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const cache = new Map()
function load(relative) {
  const file = path.resolve(root, relative)
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const localRequire = spec => spec.startsWith('@/') ? load(spec.slice(2) + '.ts') : requirePackage(spec)
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

const { create } = load('features/nexacrm/adapters/native-store.ts')
const store = create()((set, get) => ({ count: 0, increment: () => set({ count: get().count + 1 }) }))
let notifications = 0
const unsubscribe = store.subscribe(() => notifications++)
store.getState().increment()
assert.equal(store.getState().count, 1)
assert.equal(store.getInitialState().count, 0, 'SSR seed must stay immutable')
store.setState(state => ({ count: state.count + 2 }))
assert.equal(store.getState().count, 3)
assert.equal(notifications, 2)
unsubscribe()
store.setState(state => state)
assert.equal(notifications, 2)
assert.equal(create(() => ({ direct: true })).getState().direct, true)

const { parseAsString, parseAsStringLiteral } = load('features/nexacrm/adapters/query-state.ts')
assert.equal(parseAsString.parse(null), null)
assert.equal(parseAsString.withDefault('').parse(null), '')
const view = parseAsStringLiteral(['table', 'grid', 'calendar']).withDefault('table')
assert.equal(view.parse('grid'), 'grid')
assert.equal(view.parse('invalid'), 'table')
assert.equal(view.withOptions({ history: 'push' }).options.history, 'push')

const { createPersonRowParser } = load('features/nexacrm/views/apps/people/table/person-import.ts')
const parse = createPersonRowParser({ companyId: name => name === 'Acme' ? 'cmp_1' : undefined,
  accountOwnerId: name => name === 'Alex' ? 'usr_1' : undefined })
assert.equal(parse({}).ok, false)
assert.equal(parse({ name: 'Ada', email: 'invalid' }).error, 'Email is not a valid address')
const result = parse({ name: ' Ada Lovelace ', email: ' ada@example.com ', isPrimary: ' YES ', companyId: 'Acme', accountOwnerId: 'Alex' })
assert.equal(result.ok, true)
assert.equal(result.input.firstName, 'Ada')
assert.equal(result.input.lastName, 'Lovelace')
assert.equal(result.input.email, 'ada@example.com')
assert.equal(result.input.isPrimary, true)
assert.equal(result.input.companyId, 'cmp_1')
assert.equal(result.input.accountOwnerId, 'usr_1')
assert.equal(parse({ firstName: 'Ada', lastName: 'Lovelace', name: 'Ignored' }).input.firstName, 'Ada')
console.log('PASS: native store, immutable server seed, query parsers, and CSV validation/resolvers.')
