const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const express = require('express');

// Real Express routes, multipart parser, DTOs and error envelopes; no external
// service, employee record, image upload or attendance mutation is used.
const modules = new Map();
const calls = [];
const record = { id: 'fixture-attendance', employeeId: 'fixture-user', status: 'present' };
const verification = { face: { enrolled: false }, office: { configured: false } };
const service = {
  checkIn: async (...args) => { calls.push(['in', ...args]); return record; },
  checkOut: async (...args) => { calls.push(['out', ...args]); return record; },
  getVerificationStatus: async () => verification,
  enrollFace: async (...args) => { calls.push(['enroll', ...args]); return verification; },
  getMyTodayAttendance: async () => record,
  listMyAttendances: async () => ({ attendances: [], pagination: { total: 0, limit: 20, offset: 0, hasMore: false } }),
};
const mocks = {
  '../services/attendance.service': service,
  '../lib/logger': { logger: { error() {}, warn() {} } },
  '../middlewares/auth.middleware': { requireAuth(req, res, next) {
    if (req.headers.authorization !== 'Bearer fixture') return res.status(401).json({ success: false, message: 'Authentication required' });
    req.user = { userId: 'fixture-user' }; next();
  } },
  '../middlewares/permission.middleware': { requirePermission: () => (_req, _res, next) => next() },
};
function load(relative) {
  let file = path.resolve(__dirname, '../src', relative);
  if (!file.endsWith('.ts')) file += '.ts';
  if (modules.has(file)) return modules.get(file).exports;
  const mod = { exports: {} }; modules.set(file, mod);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', source)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    return name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name);
  }, mod, mod.exports);
  return mod.exports;
}
function form(fields = { latitude: '0', longitude: '0', accuracy: '10' }, file = true, bytes = 12) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  if (file) data.append('selfie', new Blob([Buffer.alloc(bytes)], { type: 'image/jpeg' }), 'selfie.jpg');
  return data;
}
async function main() {
  const { clockProofSchema } = load('types/attendance.dto');
  for (const invalid of ['', ' ', null, true, [], {}, 'NaN', 'Infinity', 91]) {
    assert.equal(clockProofSchema.safeParse({ latitude: invalid, longitude: 0 }).success, false, `invalid latitude ${JSON.stringify(invalid)}`);
  }
  assert.equal(clockProofSchema.safeParse({ latitude: 0, longitude: 0 }).success, true);
  assert.equal(clockProofSchema.safeParse({ latitude: '-90', longitude: '180' }).success, true);
  const app = express(); app.use(express.json());
  app.use('/api/attendance', load('routes/attendance.routes').attendanceRouter);
  app.use(load('middlewares/errorHandler').errorHandler);
  const server = await new Promise(resolve => { const server = app.listen(0, '127.0.0.1', () => resolve(server)); });
  const base = `http://127.0.0.1:${server.address().port}/api/attendance`;
  const request = async (route, options = {}) => {
    const response = await fetch(base + route, { ...options, headers: { authorization: 'Bearer fixture', ...options.headers } });
    return { status: response.status, body: await response.json() };
  };
  try {
    assert.equal((await request('/check-in', { method: 'POST', headers: { authorization: '' } })).status, 401);
    for (const [route, status, action] of [['/check-in', 201, 'in'], ['/check-out', 200, 'out']]) {
      const result = await request(route, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      assert.deepEqual(result, { status, body: { success: true, data: record } });
      assert.deepEqual(calls.at(-1), [action, 'fixture-user', undefined]);
    }
    assert.equal((await request('/check-in', { method: 'POST' })).status, 201);
    assert.equal(calls.at(-1)[2], undefined);
    const valid = await request('/check-in', { method: 'POST', body: form() });
    assert.equal(valid.status, 201, JSON.stringify(valid));
    assert.equal(calls.at(-1)[2].latitude, 0);
    assert.equal(calls.at(-1)[2].longitude, 0);
    assert.equal(calls.at(-1)[2].accuracyM, 10);
    assert.ok(Buffer.isBuffer(calls.at(-1)[2].selfie));
    for (const body of [form({}, false), form({ latitude: '1' }), form({ latitude: '', longitude: '0' }),
      form({ latitude: '91', longitude: '0' }), form({ latitude: '0', longitude: '181' }),
      form({ latitude: '0', longitude: '0', accuracy: '-1' }), form(undefined, true, 5 * 1024 * 1024 + 1)]) {
      const count = calls.length;
      const result = await request('/check-in', { method: 'POST', body });
      assert.equal(result.status, 400, JSON.stringify(result));
      assert.equal(result.body.success, false);
      assert.equal(calls.length, count, 'invalid multipart must never downgrade to legacy attendance');
    }
    const jsonProof = await request('/check-in', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{"latitude":0,"longitude":0}' });
    assert.equal(jsonProof.status, 400);
    assert.equal(jsonProof.body.code, 'SELFIE_REQUIRED');
    assert.deepEqual(await request('/me/verification'), { status: 200, body: { success: true, data: verification } });
    assert.equal((await request('/me/face', { method: 'POST', body: form({}) })).status, 200);
    assert.equal(calls.at(-1)[0], 'enroll');
    assert.equal((await request('/me/face', { method: 'POST', body: form({}, false) })).status, 400);
    const mine = await request('/me');
    assert.deepEqual(mine.body.data.pagination, { total: 0, limit: 20, offset: 0, hasMore: false });
    console.log('PASS: legacy JSON/no-body API, multipart validation/no downgrade, upload limits, auth, enrollment/status routes, and pagination envelopes.');
  } finally { await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
