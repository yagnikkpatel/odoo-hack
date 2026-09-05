import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const root = fileURLToPath(new URL('../', import.meta.url))
const read = file => readFileSync(root + file, 'utf8')
const compiled = ts.transpileModule(read('features/nexacrm/lib/date-time.ts'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const loaded = { exports: {} }
new Function('module', 'exports', compiled)(loaded, loaded.exports)
const { parseDateValue, dateValue, isTimeValue, dateWithinBounds, withDate } = loaded.exports

for (const day of ['2024-02-29', '2026-09-05', '2026-01-01', '2026-12-31', '0099-06-01']) {
  const parsed = parseDateValue(day)
  assert.ok(parsed)
  assert.equal(dateValue(parsed), day, 'date-only values must not shift across time zones')
  assert.equal(parsed.getHours(), 0)
}
for (const invalid of ['', '2026-02-29', '2026-04-31', '2026-00-10', '2026-13-01', '2026-01-00', '2026-9-5', '2026-09-05T09:00']) {
  assert.equal(parseDateValue(invalid), undefined)
}
for (const time of ['00:00', '09:00', '12:00', '18:45', '23:59']) assert.ok(isTimeValue(time))
for (const time of ['', '24:00', '12:60', '9:00', '01:00 PM', 'aa:bb']) assert.equal(isTimeValue(time), false)
assert.ok(dateWithinBounds('2026-09-05', '2026-09-05', '2026-09-05'), 'bounds are inclusive')
assert.equal(dateWithinBounds('2026-09-04', '2026-09-05'), false)
assert.equal(dateWithinBounds('2026-09-06', undefined, '2026-09-05'), false)
assert.equal(dateWithinBounds(''), false)
assert.equal(withDate('2026-09-05T23:59', '2026-09-06'), '2026-09-06T23:59', 'changing date preserves exact minutes')
assert.equal(withDate('', '2026-09-05'), '2026-09-05T09:00')
assert.equal(withDate('2026-09-05T09:00', ''), '', 'clearing date also clears its time')

const integrations = {
  'features/attendance/index.tsx': 'DatePicker',
  'features/attendance/editor.tsx': 'DateTimePicker',
  'features/contracts/components/contract-editor.tsx': 'DatePicker',
  'features/working-schedules/editor.tsx': 'TimePicker',
  'features/nexacrm/components/record/date-time-field.tsx': 'DateTimePicker'
}
for (const [file, component] of Object.entries(integrations)) assert.ok(read(file).includes('<' + component), file)
function guardNativeInputs(dir) {
  for (const entry of readdirSync(root + dir, { withFileTypes: true })) {
    const file = dir + '/' + entry.name
    if (entry.isDirectory()) guardNativeInputs(file)
    else if (file.endsWith('.tsx')) assert.doesNotMatch(read(file), /type\s*=\s*['"](?:date|time|datetime-local)['"]/, file)
  }
}
guardNativeInputs('features')
guardNativeInputs('app')
const date = read('features/nexacrm/components/ui/date-picker.tsx')
const time = read('features/nexacrm/components/ui/time-picker.tsx')
assert.match(date, /<Calendar/)
assert.match(date, /label='Month'/)
assert.match(date, /label='Year'/)
assert.doesNotMatch(date, /captionLayout=['"]dropdown/)
assert.match(date, /disabled=\{day => !dateWithinBounds/)
assert.match(time, /setDraft\(isTimeValue\(value\) \? value : '09:00'\)/, 'opening discards uncommitted edits')
assert.match(time, /disabled=\{!isTimeValue\(draft\)\}/)
assert.match(time, /label='Hour'/)
assert.match(time, /label='Minute'/)
assert.match(time, /event.preventDefault\(\)/, 'Enter applies time without submitting the parent form')
console.log('PASS: themed date/time integrations, local-date and leap-day boundaries, inclusive limits, all minutes, clear/preserve semantics, no native temporal inputs. TZ=' + (process.env.TZ || 'device'))
