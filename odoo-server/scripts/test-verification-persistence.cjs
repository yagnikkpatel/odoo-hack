const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Isolated contract tests: never connects to a database or an external service.
const queries = [];
const pool = { async query(sql, values) { queries.push({ sql, values }); return { rows: [] }; } };
const modules = new Map();
function load(relative) {
  const file = path.resolve(__dirname, '../src', relative + '.ts');
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = name => {
    if (name === '../lib/db') return { pool };
    if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
    return require(name);
  };
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}

async function main() {
  const schema = load('types/employee.dto').updateEmployeeProfileSchema;
  for (const payload of [
    { workLatitude: 0, workLongitude: 0 },
    { workLatitude: -90, workLongitude: 180 },
    { workLatitude: null, workLongitude: null },
    { workRadiusM: 10 }, { workRadiusM: 5000 },
    { managerId: null, location: null }, { jobPosition: 'Engineer' },
  ]) assert.equal(schema.safeParse(payload).success, true);
  for (const payload of [
    { workLatitude: 0 }, { workLongitude: 0 },
    { workLatitude: null, workLongitude: 2 },
    { workLatitude: Infinity, workLongitude: 0 },
    { workLatitude: NaN, workLongitude: 0 },
    { workLatitude: 91, workLongitude: 0 },
    { workRadiusM: 9 }, { workRadiusM: 5001 }, { workRadiusM: 10.5 }, {},
  ]) assert.equal(schema.safeParse(payload).success, false);

  const employee = load('repositories/employee.repository');
  for (const descriptor of [[], Array(127).fill(0), Array(129).fill(0), Array(128),
    [...Array(127).fill(0), NaN], [...Array(127).fill(0), Infinity]]) {
    await assert.rejects(employee.saveFaceTemplate('fixture', descriptor, 'self', null), /128 finite/);
  }
  assert.equal(queries.length, 0, 'invalid descriptors must not reach storage');
  const descriptor = Array(128).fill(0.1);
  await employee.saveFaceTemplate('fixture', descriptor, 'hr_photo', null, 'https://example.invalid/avatar');
  assert.match(queries.at(-1).sql, /FOR UPDATE/);
  assert.match(queries.at(-1).sql, /face_descriptor IS NULL AND employee_image_url = \$6/);
  assert.equal(queries.at(-1).values[5], 'https://example.invalid/avatar');
  await employee.clearFaceTemplate('fixture', 'hr_photo');
  assert.match(queries.at(-1).sql, /RETURNING previous.face_image_public_id/);
  assert.deepEqual(queries.at(-1).values, ['fixture', 'hr_photo']);
  await employee.findProfileByUserId('fixture');
  assert.doesNotMatch(queries.at(-1).sql, /face_descriptor/);
  await employee.findVerificationProfile('fixture');
  assert.match(queries.at(-1).sql, /face_descriptor/);

  const attendance = load('repositories/attendance.repository');
  await attendance.checkInEmployee('fixture');
  assert.equal(queries.at(-1).values[2], null, 'legacy check-in remains compatible');
  assert.match(queries.at(-1).sql, /ON CONFLICT .* DO NOTHING/);
  const verification = { fixture: true };
  await attendance.checkOutEmployee('fixture', verification);
  assert.equal(queries.at(-1).values[2], verification);
  assert.match(queries.at(-1).sql, /\)\s+AND check_out IS NULL\s+RETURNING/,
    'concurrent checkout must recheck status on the target row');
  console.log('PASS: Geofence DTO, nullable fields, descriptor validity/non-disclosure, enrollment race guards, and attendance persistence contracts.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
