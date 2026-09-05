import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Exact UI parity: import namespace plus one type-only replacement of source `any`.
const project = fileURLToPath(new URL('../', import.meta.url));
const warehouse = path.resolve(process.argv[2] ?? path.join(project,
  '../../odoo-hack-final-26/component-warehouse/shadcn-nextjs-nexacrm-app-template-1.0.0'));
const feature = path.join(project, 'features/nexacrm');
const analytics = 'views/dashboards/analytics';
let verified = 0;
const assets = new Set();

function verifyDirectory(relative) {
  for (const entry of readdirSync(path.join(feature, relative), { withFileTypes: true })) {
    const file = path.join(relative, entry.name);
    if (entry.isDirectory()) { verifyDirectory(file); continue; }
    const original = readFileSync(path.join(warehouse, 'src', file), 'utf8');
    const actual = readFileSync(path.join(feature, file), 'utf8');
    const expected = original.replaceAll("'@/", "'@/features/nexacrm/")
      .replace('function Filter({ column }: { column: Column<any, unknown> }) {',
        'function Filter<TData extends RowData>({ column }: { column: Column<TData, unknown> }) {');
    assert.equal(actual, expected, `Source drift: ${file}`);
    for (const match of original.matchAll(/['"](\/images\/[^'"]+)['"]/g)) assets.add(match[1]);
    verified++;
  }
}

verifyDirectory(analytics);
for (const asset of assets) {
  assert.deepEqual(readFileSync(path.join(project, 'public', asset)),
    readFileSync(path.join(warehouse, 'public', asset)), `Asset drift: ${asset}`);
}
const route = readFileSync(path.join(project, 'app/(app)/dashboards/analytics/page.tsx'), 'utf8');
assert.ok(route.includes('@/features/nexacrm/views/dashboards/analytics'), 'Route must render the original view');
assert.ok(!route.includes('@/features/dashboard'), 'Custom workforce dashboard must not be connected');
console.log(`PASS: ${verified} analytics files match the warehouse (import paths and one type-only fix); ${assets.size} assets match byte-for-byte; original route verified.`);
