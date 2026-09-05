import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const cache = new Map()
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')

function load(relative) {
  const file = path.resolve(root, relative)
  if (cache.has(file)) return cache.get(file).exports
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX
    }
  }).outputText
  const localRequire = specifier => {
    if (specifier === 'server-only') return {}
    if (specifier.startsWith('@/') || specifier.startsWith('.')) {
      const base = specifier.startsWith('@/')
        ? path.join(root, specifier.slice(2))
        : path.resolve(path.dirname(file), specifier)
      const resolved = [base, base + '.ts', base + '.tsx'].find(
        candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()
      )
      assert.ok(resolved, 'Cannot resolve ' + specifier)
      return load(resolved)
    }
    return requirePackage(specifier)
  }
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}

function filesIn(relative) {
  const directory = path.join(root, relative)
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const child = path.join(relative, entry.name)
    return entry.isDirectory() ? filesIn(child) : [child]
  })
}

assert.deepEqual(filesIn('features/nexacrm/fake-db'), [], 'Runtime template database must stay removed')
for (const file of filesIn('features/nexacrm').filter(file => /\.tsx?$/.test(file))) {
  assert.doesNotMatch(read(file), /fake-db|Math\.random\(|@faker-js|from ['"]faker/, file)
}

// Unconnected services must never call a backend or return fictional records.
const originalFetch = globalThis.fetch
globalThis.fetch = () => {
  throw new Error('A non-auth API was called')
}
try {
  for (const name of [
    'activity',
    'attachment',
    'calendar-event',
    'company',
    'email',
    'note',
    'opportunity',
    'person',
    'task'
  ]) {
    const service = load('features/nexacrm/services/' + name + '-service.ts')
    for (const [method, action] of Object.entries(service)) {
      const result = await action('person', 'test-record')
      if (method.endsWith('ById')) assert.equal(result, undefined, method)
      else if (method === 'getNotesData') assert.deepEqual(result, { notes: [], noteTargets: [] })
      else if (method === 'getTasksData') assert.deepEqual(result, { tasks: [], taskTargets: [] })
      else {
        assert.deepEqual(result, [], method)
        result.push({ id: 'caller-only' })
        assert.deepEqual(await action('person', 'test-record'), [], method + ' must not leak mutable results')
      }
    }
  }
} finally {
  globalThis.fetch = originalFetch
}

const analytics = load('features/nexacrm/views/dashboards/analytics/analytics-data.tsx')
assert.deepEqual(analytics.dealsData, [])
assert.deepEqual(analytics.statData, [])
assert.deepEqual(analytics.earningReportChartData, [])
assert.equal(analytics.StatisticsCardData.length, 2, 'Keep the original card slots')
for (const metric of analytics.StatisticsCardData) {
  assert.equal(metric.value, null, 'Unknown values are not fabricated zeroes')
  assert.equal(metric.changePercentage, null, 'Unknown trends are not fabricated percentages')
}
for (const file of filesIn('features/nexacrm/views/dashboards/analytics').filter(file => /\.tsx?$/.test(file))) {
  assert.doesNotMatch(
    read(file),
    /Jack Alfredo|Hallie Richards|Olivia Sparks|\$88\.5k|\$5,550|5688 xxxx|visitors:\s*500/,
    file
  )
}

const { useFavoritesStore } = load('features/nexacrm/store/use-favorites-store.ts')
assert.deepEqual(useFavoritesStore.getInitialState().keys, [])
const { useEmailsStore } = load('features/nexacrm/store/use-emails-store.ts')
assert.deepEqual(useEmailsStore.getInitialState().emails, [])
assert.equal('addEmail' in useEmailsStore.getState(), false, 'No fake outbound email logging')
const composer = read('features/nexacrm/components/record/email-composer.tsx')
assert.match(composer, /Email integration is not connected/)
assert.match(composer, /<Button size='sm' disabled/)
assert.doesNotMatch(composer, /toast\.success|addEmail|onClick=\{send\}/)

console.log(
  'PASS: no template fake database, typed empty services, unknown analytics, empty favorites, and no fake email sending.'
)
