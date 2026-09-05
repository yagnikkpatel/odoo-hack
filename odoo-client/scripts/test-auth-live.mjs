import assert from 'node:assert/strict'

// Probe the running Next server, not imported route handlers. No credentials,
// upstream requests, account writes, server startup or mocks are involved.
const base = new URL(process.env.AUTH_TEST_BASE_URL || 'http://localhost:3000')
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)) {
  throw new Error('This smoke test only targets a local running frontend.')
}

let passed = 0
async function probe(path, expectedStatus, { method = 'POST', origin = base.origin, body = {} } = {}) {
  const response = await fetch(new URL(path, base), {
    method,
    headers: { Origin: origin, 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    cache: 'no-store',
    redirect: 'manual',
    signal: AbortSignal.timeout(10_000)
  })
  assert.notEqual(
    response.status,
    404,
    `${path} is not registered in the running frontend. If its route file exists, restart the existing Next server and rerun this check.`
  )
  assert.equal(response.status, expectedStatus, `${method} ${path}: unexpected HTTP status`)
  assert.match(response.headers.get('content-type') || '', /application\/json/, `${path} must return JSON, not an HTML error page`)
  assert.match(response.headers.get('cache-control') || '', /no-store/)
  const payload = await response.json()
  assert.equal(payload.success, false)
  assert.equal(typeof payload.message, 'string')
  assert.doesNotMatch(JSON.stringify(payload), /accessToken|resetToken|password_hash/)
  passed++
  console.log(`PASS: ${method} ${path} — HTTP ${response.status}`)
}

try {
  for (const route of ['login', 'logout', 'forgot-password', 'verify-otp', 'reset-password']) {
    await probe(`/api/auth/${route}`, 403, { origin: 'https://untrusted.example' })
  }
  for (const route of ['login', 'forgot-password', 'verify-otp', 'reset-password']) {
    await probe(`/api/auth/${route}`, 400)
  }
  await probe('/api/auth/session', 401, { method: 'GET' })
  await probe('/api/auth/reset-password', 401, {
    body: { newPassword: 'not-submitted-test-password', confirmPassword: 'not-submitted-test-password' }
  })
  console.log(`Live auth routing: ${passed} checks passed. This checks route availability and rejection paths, not successful password recovery.`)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Live auth routing failed.')
  process.exitCode = 1
}
