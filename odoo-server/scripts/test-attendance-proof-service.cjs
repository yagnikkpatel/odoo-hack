const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

// Isolated service tests. No live database, Redis, uploads or employee records.
const modules = new Map();
const vector = Array(128).fill(0.1);
const image = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const settings = { faceMatchThreshold: 0.5, locationMaxAccuracyM: 1000, locationAccuracyAllowanceM: 100, attendanceStoreSelfies: true };
let state;
function reset() {
  state = {
    today: null, open: null, lock: 'OK', distance: 0.1, saved: true,
    profile: { userId: 'employee', workLocation: 'Office', workLatitude: 0, workLongitude: 0, workRadiusM: 100, faceDescriptor: vector, faceSource: 'self', faceImageUrl: null, faceEnrolledAt: new Date(), employeeImageUrl: null },
    faceCalls: 0, uploads: 0, inserts: 0, exits: 0, cleanup: [], releases: [], uploadFails: false, writeFails: false,
    templateSaves: 0, fetchCalls: 0,
  };
  settings.attendanceStoreSelfies = true;
}
const mocks = {
  '../config/env': { env: settings },
  '../lib/cache': { invalidateCache: async () => {}, bumpCacheVersion: async () => {} },
  '../lib/face': {
    describeFace: async () => { state.faceCalls++; if (state.faceError) throw state.faceError; await state.onDescribe?.(); return { descriptor: vector, detectionScore: 0.99 }; },
    faceDistance: () => state.distance,
  },
  '../lib/cloudinary': { uploadImageToCloudinary: async () => { state.uploads++; if (state.uploadFails) throw new Error('Offline'); return { url: 'https://image.example/selfie.jpg', publicId: 'selfie-id' }; } },
  '../lib/logger': { logger: { warn() {}, info() {} } },
  '../lib/redis': { redis: { set: async () => { if (state.lock instanceof Error) throw state.lock; return state.lock; }, eval: async (...args) => state.releases.push(args) } },
  '../queues/deleteCloudinaryImage.queue': { enqueueCloudinaryImageDeletion: async (id) => state.cleanup.push(id) },
  '../repositories/employee.repository': {
    findVerificationProfile: async () => state.profile,
    saveFaceTemplate: async (_id, descriptor, source, stored, expectedImageUrl) => {
      state.templateSaves++;
      if (source === 'hr_photo' && (state.profile.faceDescriptor || state.profile.employeeImageUrl !== expectedImageUrl)) return null;
      if (!state.saved) return null;
      if (state.writeFails) throw new Error('Database write failed');
      state.profile = { ...state.profile, faceDescriptor: descriptor, faceSource: source, faceImageUrl: stored?.url ?? null, faceEnrolledAt: new Date() };
      return { previousImagePublicId: 'old-face' };
    },
  },
  './employee.service': { invalidateEmployeeCaches: async () => {} },
  '../repositories/attendance.repository': {
    findTodayAttendance: async () => state.today,
    findOpenAttendance: async () => state.open,
    checkInEmployee: async (_id, proof) => {
      state.inserts++;
      if (state.writeFails) throw new Error('Database write failed');
      if (!state.saved) return null;
      return { id: 'attendance', employeeId: 'employee', attendanceDate: '2026-09-06', checkInVerification: proof };
    },
    checkOutEmployee: async (_id, proof) => {
      state.exits++;
      if (state.writeFails) throw new Error('Database write failed');
      if (!state.saved) return null;
      return { id: 'attendance', employeeId: 'employee', attendanceDate: '2026-09-06', checkOutVerification: proof };
    },
  },
};
function load(relative) {
  let file = path.resolve(__dirname, '../src', relative);
  if (!file.endsWith('.ts')) file += '.ts';
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} };
  modules.set(file, module);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const localRequire = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(path.resolve(path.dirname(file), name)) : require(name);
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const service = load('services/attendance.service');
const { AppError } = load('errors/AppError');
const proof = { selfie: image, latitude: 0, longitude: 0, accuracyM: 5 };
async function rejects(action, status, code) {
  await assert.rejects(action, error => error.statusCode === status && (!code || error.code === code));
}
async function testHrPhotos() {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    state.fetchCalls++;
    if (state.fetchError) throw state.fetchError;
    assert.equal(url.hostname, 'res.cloudinary.com');
    assert.equal(options.redirect, 'error');
    assert.ok(options.signal instanceof AbortSignal);
    return new Response(state.fetchBody ?? image);
  };
  const prepare = suffix => {
    reset();
    state.profile.faceDescriptor = null;
    state.profile.employeeImageUrl = `https://res.cloudinary.com/test/${suffix}.jpg`;
  };
  try {
    prepare('dedupe');
    const [first, second] = await Promise.all([
      service.getVerificationStatus('employee'), service.getVerificationStatus('employee'),
    ]);
    assert.equal(first.face.enrolled, true);
    assert.equal(second.face.source, 'hr_photo');
    assert.equal(state.fetchCalls, 1);
    assert.equal(state.faceCalls, 1);
    assert.equal(state.templateSaves, 1);
    assert.equal(JSON.stringify(first).includes('descriptor'), false);
    await service.getVerificationStatus('employee');
    assert.equal(state.fetchCalls, 1, 'persisted HR embeddings must not be recomputed');

    prepare('self-enrollment-race');
    state.onDescribe = async () => {
      state.profile = { ...state.profile, faceDescriptor: Array(128).fill(0.9), faceSource: 'self' };
    };
    const race = await service.getVerificationStatus('employee');
    assert.equal(race.face.source, 'self', 'HR inference must not overwrite concurrent self-enrollment');
    assert.equal(state.profile.faceDescriptor[0], 0.9);

    prepare('oversized');
    state.fetchBody = Buffer.alloc(5 * 1024 * 1024 + 1);
    assert.equal((await service.getVerificationStatus('employee')).face.enrolled, false);
    assert.equal(state.faceCalls, 0);
    assert.equal(state.templateSaves, 0);
    await service.getVerificationStatus('employee');
    assert.equal(state.fetchCalls, 1, 'unusable HR photos should have a short negative cache');

    prepare('untrusted');
    state.profile.employeeImageUrl = 'https://attacker.invalid/face.jpg';
    assert.equal((await service.getVerificationStatus('employee')).face.enrolled, false);
    assert.equal(state.fetchCalls, 0, 'untrusted hosts must never be requested');

    prepare('malformed');
    state.profile.employeeImageUrl = 'not a URL';
    assert.equal((await service.getVerificationStatus('employee')).face.enrolled, false);
    assert.equal(state.fetchCalls, 0);

    prepare('offline');
    state.fetchError = new TypeError('fetch failed');
    assert.equal((await service.getVerificationStatus('employee')).face.enrolled, false,
      'an unavailable HR image must not prevent opening the self-enrollment UI');
    assert.equal(state.faceCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
}
async function main() {
  reset();
  const legacy = await service.checkIn('employee');
  assert.equal(legacy.checkInVerification, null);
  assert.equal(state.faceCalls, 0);
  state.open = legacy;
  assert.equal((await service.checkOut('employee')).checkOutVerification, null);

  reset();
  const verified = await service.checkIn('employee', proof);
  assert.equal(verified.checkInVerification.face.status, 'matched');
  assert.equal(verified.checkInVerification.location.status, 'inside');
  assert.equal(verified.checkInVerification.face.threshold, 0.5);
  assert.equal(state.faceCalls, 1);
  assert.equal(state.uploads, 1);
  assert.equal(state.releases.length, 1);
  assert.match(state.releases[0][0], /ARGV\[1\]/);
  assert.ok(state.releases[0][3]);
  state.open = verified;
  const checkedOut = await service.checkOut('employee', proof);
  assert.equal(checkedOut.checkOutVerification.face.status, 'matched');

  reset();
  state.today = { checkIn: new Date() };
  await rejects(service.checkIn('employee', proof), 409);
  assert.equal(state.faceCalls, 0);
  assert.equal(state.uploads, 0);

  reset();
  await rejects(service.checkOut('employee', proof), 404);
  assert.equal(state.faceCalls, 0);
  state.today = { checkOut: new Date() };
  await rejects(service.checkOut('employee', proof), 409);

  reset();
  state.lock = null;
  await rejects(service.checkIn('employee', proof), 409, 'ATTENDANCE_BUSY');
  assert.equal(state.faceCalls, 0);
  assert.equal(state.releases.length, 0);
  state.lock = new Error('Redis is down');
  await service.checkIn('employee', proof);
  assert.equal(state.inserts, 1);

  reset();
  await rejects(service.checkIn('employee', { ...proof, latitude: 1 }), 422, 'OUTSIDE_GEOFENCE');
  assert.equal(state.faceCalls, 0);
  assert.equal(state.uploads, 0);
  await rejects(service.checkIn('employee', { ...proof, accuracyM: 1001 }), 422, 'LOCATION_IMPRECISE');
  await rejects(service.checkIn('employee', { ...proof, longitude: NaN }), 400, 'LOCATION_REQUIRED');
  await rejects(service.checkIn('employee', { ...proof, selfie: Buffer.from('not an image') }), 400);

  reset();
  state.profile.workLatitude = null;
  state.profile.workLongitude = null;
  assert.equal((await service.checkIn('employee', proof)).checkInVerification.location.status, 'not_configured');
  state.profile.faceDescriptor = null;
  await rejects(service.checkIn('employee', proof), 409, 'FACE_NOT_ENROLLED');

  reset();
  state.distance = 0.501;
  await rejects(service.checkIn('employee', proof), 422, 'FACE_MISMATCH');
  assert.equal(state.uploads, 0);
  assert.equal(state.inserts, 0);
  state.distance = NaN;
  await rejects(service.checkIn('employee', proof), 422, 'FACE_MISMATCH');
  state.distance = 0.5;
  await service.checkIn('employee', proof); // Prior threshold remains inclusive.

  reset();
  state.faceError = new AppError(400, 'No face', 'FACE_NOT_DETECTED');
  await rejects(service.checkIn('employee', proof), 400, 'FACE_NOT_DETECTED');
  assert.equal(state.inserts, 0);

  reset();
  state.uploadFails = true;
  assert.equal((await service.checkIn('employee', proof)).checkInVerification.selfieUrl, null);
  reset();
  settings.attendanceStoreSelfies = false;
  assert.equal((await service.checkIn('employee', proof)).checkInVerification.selfieUrl, null);
  assert.equal(state.uploads, 0);

  reset();
  state.saved = false; // Atomic insert lost a concurrent race after verification.
  await rejects(service.checkIn('employee', proof), 409);
  assert.deepEqual(state.cleanup, ['selfie-id']);
  reset();
  state.open = { checkIn: new Date() };
  state.writeFails = true;
  await assert.rejects(service.checkOut('employee', proof), /Database write failed/);
  assert.deepEqual(state.cleanup, ['selfie-id']);

  reset();
  const enrollment = await service.enrollFace('employee', image);
  assert.equal(enrollment.face.enrolled, true);
  assert.equal(enrollment.face.source, 'self');
  assert.equal(JSON.stringify(enrollment).includes('descriptor'), false);
  assert.deepEqual(state.cleanup, ['old-face']);
  reset();
  state.saved = false;
  await rejects(service.enrollFace('employee', image), 404, 'PROFILE_MISSING');
  assert.deepEqual(state.cleanup, ['selfie-id']);
  reset();
  state.profile = null;
  await rejects(service.enrollFace('employee', image), 404, 'PROFILE_MISSING');
  assert.equal(state.faceCalls, 0);
  assert.equal((await service.getVerificationStatus('employee')).face.enrolled, false);

  await testHrPhotos();
  console.log('Attendance service: legacy compatibility, verified check-in/out, early rejection, strict proof, face threshold, locks, storage failure, cleanup, enrollment, HR-photo deduplication, size bounds and template races passed.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
