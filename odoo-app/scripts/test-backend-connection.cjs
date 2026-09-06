const assert = require('node:assert/strict');
const http = require('node:http');
const { normalizeBackendUrl, isProductionBuild } = require('../config/backend.cjs');
const { lanHost, options, checkHealth } = require('./connect-backend.cjs');
const configure = require('../app.config.js');
const settings = require('../backend.config.json');

async function main() {
  assert.equal(normalizeBackendUrl(' https://backend.example.com/ '), 'https://backend.example.com/api');
  assert.equal(normalizeBackendUrl('https://backend.example.com/api///'), 'https://backend.example.com/api');
  assert.equal(normalizeBackendUrl('https://backend.example.com/service/api'), 'https://backend.example.com/service/api');
  assert.equal(normalizeBackendUrl('http://192.168.1.10:4000'), 'http://192.168.1.10:4000/api');
  for (const value of ['', 'example.com', 'ftp://example.com', 'https://user:secret@example.com', 'https://example.com?token=secret', 'https://example.com/#x', 'https://example.com/api/auth/login']) {
    assert.throws(() => normalizeBackendUrl(value), undefined, value);
  }
  for (const value of ['http://backend.example.com', 'https://localhost', 'https://127.0.0.1', 'https://192.168.9.1', 'https://10.0.0.1', 'https://172.20.0.1', 'https://169.254.1.2', 'https://100.64.1.1', 'https://[::1]', 'https://office.local']) {
    assert.throws(() => normalizeBackendUrl(value, { production: true }), /public HTTPS/, value);
  }
  assert.equal(isProductionBuild({ NODE_ENV: 'production' }), true);
  assert.equal(isProductionBuild({ EAS_BUILD_PROFILE: 'preview' }), true);
  assert.equal(isProductionBuild({ EAS_BUILD_PROFILE: 'development' }), false);
  assert.equal(lanHost({ utun0: [{ family: 'IPv4', address: '10.0.0.2', internal: false }], en0: [{ family: 'IPv4', address: '192.168.1.4', internal: false }] }), '192.168.1.4');
  assert.throws(() => lanHost({ lo: [{ family: 'IPv4', address: '127.0.0.1', internal: true }] }), /No LAN/);
  assert.deepEqual(options(['dev', '--url', 'http://localhost:4000', '--web']), { mode: 'dev', expo: ['--web'], url: 'http://localhost:4000' });
  assert.equal(options(['dev', '--check-only']).checkOnly, true);
  assert.throws(() => options(['production', '--url']), /requires/);
  assert.throws(() => options(['production', '--unknown']), /Unknown/);

  const previous = { ...process.env };
  const previousUrl = settings.productionUrl;
  try {
    delete process.env.APP_PRODUCTION_API_URL;
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.APP_ENV;
    process.env.NODE_ENV = 'production';
    settings.productionUrl = null;
    assert.throws(() => configure({ config: {} }), /Backend URL is missing/);
    // This fixture never writes the real settings file or contacts a domain.
    settings.productionUrl = 'https://backend.example.com';
    process.env.EXPO_PUBLIC_API_URL = 'http://192.168.1.100:4000';
    const result = configure({ config: { name: 'Keep app settings', extra: { untouched: true } } });
    assert.equal(result.extra.apiUrl, 'https://backend.example.com/api', 'saved production hostname wins over stale LAN .env');
    assert.equal(result.extra.untouched, true);
    assert.equal(result.name, 'Keep app settings');
    process.env.APP_PRODUCTION_API_URL = 'https://staging.example.com';
    assert.equal(configure({ config: {} }).extra.apiUrl, 'https://staging.example.com/api');
    process.env.NODE_ENV = 'development';
    assert.equal(configure({ config: {} }).extra.apiUrl, 'http://192.168.1.100:4000/api');
  } finally {
    settings.productionUrl = previousUrl;
    for (const key of ['NODE_ENV', 'APP_ENV', 'APP_PRODUCTION_API_URL', 'EXPO_PUBLIC_API_URL', 'EAS_BUILD_PROFILE']) {
      if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
    }
  }

  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: req.url === '/api/health' }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    await checkHealth(normalizeBackendUrl(origin));
    await assert.rejects(checkHealth(origin + '/wrong'), /health check failed/);
    await assert.rejects(checkHealth(origin, async () => { throw new Error('offline'); }), /offline/);
  } finally { await new Promise(resolve => server.close(resolve)); }
  console.log('PASS: URL normalization, public HTTPS release guard, build config embedding/precedence, LAN selection, CLI options and live HTTP health checks.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
