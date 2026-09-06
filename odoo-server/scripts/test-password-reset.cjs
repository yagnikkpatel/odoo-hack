// End-to-end check of the SMTP password reset flow. Uses the development
// Postgres, an isolated Redis database, and an SMTP sink bound to loopback --
// never real SMTP. Creates and removes one throwaway user; demo data is
// untouched.
const assert = require('node:assert/strict')
const net = require('node:net')
const path = require('node:path')
const { once } = require('node:events')
const { spawn } = require('node:child_process')
const bcrypt = require('bcryptjs')
const { Client } = require('pg')
const Redis = require('ioredis')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const EMAIL = `password-reset-test-${Date.now()}@mail.test`
const ORIGINAL_PASSWORD = 'original-pass-1'
const NEW_PASSWORD = 'brand-new-pass-2'
const REDIS_URL = `${(process.env.REDIS_URL || 'redis://127.0.0.1:6385').split('/').slice(0, 3).join('/')}/9`
const COOLDOWN_SECONDS = 2
const MAX_ATTEMPTS = 3

const inboxes = []
const smtp = net.createServer(socket => {
  let body = null
  let buffer = ''
  socket.write('220 localhost test SMTP\r\n')
  socket.on('data', chunk => {
    buffer += chunk.toString()
    let index
    while ((index = buffer.indexOf('\r\n')) !== -1) {
      const line = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      if (body !== null) {
        if (line === '.') { inboxes.push(body.join('\n')); body = null; socket.write('250 2.0.0 accepted\r\n') }
        else body.push(line)
      } else if (/^(EHLO|HELO)/i.test(line)) socket.write('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 10000000\r\n')
      else if (/^DATA/i.test(line)) { body = []; socket.write('354 send it\r\n') }
      else if (/^QUIT/i.test(line)) { socket.write('221 bye\r\n'); socket.end() }
      else socket.write('250 OK\r\n')
    }
  })
  socket.on('error', () => {})
})

const children = []
function stopChildren(signal) {
  for (const child of children) {
    try { process.kill(-child.pid, signal) } catch { try { child.kill(signal) } catch {} }
  }
}
function launch(entry, extraEnv) {
  // Detached so the whole group can be signalled: killing the npx wrapper
  // alone would leave the tsx process it spawned holding its port.
  const child = spawn('npx', ['tsx', entry], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...runtime, ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => process.env.VERBOSE && process.stderr.write(chunk))
  }
  children.push(child)
  return child
}

async function freePort() {
  const server = net.createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  await new Promise(resolve => server.close(resolve))
  return port
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

let runtime
let base

async function call(route, body) {
  const response = await fetch(`${base}/api/auth/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, payload: await response.json().catch(() => null) }
}

async function waitForEmail(previousCount) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (inboxes.length > previousCount) return inboxes[inboxes.length - 1]
    await sleep(100)
  }
  throw new Error('No password reset email arrived within 10s')
}

function otpFrom(message) {
  const subject = message.split('\n').find(line => /^Subject:/i.test(line)) ?? ''
  const match = subject.match(/\b(\d{6})\b/)
  assert.ok(match, `No 6-digit code in subject: ${subject}`)
  return match[1]
}

async function main() {
  smtp.listen(0, '127.0.0.1')
  await once(smtp, 'listening')

  const db = new Client({ connectionString: process.env.DATABASE_URL })
  await db.connect()
  const role = await db.query("SELECT id FROM roles WHERE name = 'employee'")
  await db.query(
    'INSERT INTO users (name, email, password_hash, role_id, status) VALUES ($1, $2, $3, $4, $5)',
    ['Reset Test User', EMAIL, await bcrypt.hash(ORIGINAL_PASSWORD, 12), role.rows[0].id, 'active'],
  )

  const redis = new Redis(REDIS_URL)
  await redis.flushdb()

  const port = await freePort()
  base = `http://127.0.0.1:${port}`
  runtime = {
    ...process.env,
    PORT: String(port),
    REDIS_URL,
    LOG_LEVEL: 'error',
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.address().port),
    SMTP_SECURE: 'false',
    SMTP_USER: 'test',
    SMTP_PASSWORD: 'test',
    SMTP_FROM_EMAIL: 'auth@mail.test',
    SMTP_FROM_NAME: 'Reset test',
    PASSWORD_RESET_OTP_TTL_SECONDS: '600',
    PASSWORD_RESET_OTP_MAX_ATTEMPTS: String(MAX_ATTEMPTS),
    PASSWORD_RESET_RESEND_COOLDOWN_SECONDS: String(COOLDOWN_SECONDS),
  }

  launch('src/server.ts')
  launch('src/workers/authEmail.worker.ts')

  for (let attempt = 0; ; attempt++) {
    try { await fetch(`${base}/api/health`); break } catch {
      if (attempt > 100) throw new Error('API did not start')
      await sleep(100)
    }
  }

  try {
    // An unknown address is accepted without issuing a code, so the response
    // cannot be used to discover which addresses are registered.
    const before = inboxes.length
    const unknown = await call('forgot-password', { email: 'nobody@mail.test' })
    assert.equal(unknown.status, 200)
    await sleep(1500)
    assert.equal(inboxes.length, before, 'An unknown email must not trigger a send')
    // The cooldown must answer the same way for both, or a repeat request would
    // reveal whether an address is registered.
    const unknownRepeat = await call('forgot-password', { email: 'nobody@mail.test' })
    assert.equal(unknownRepeat.status, 429, 'The cooldown must apply to unknown addresses too')
    console.log('PASS unknown email is accepted silently, sends nothing, and shares the cooldown')

    const firstRequest = await call('forgot-password', { email: EMAIL })
    assert.equal(firstRequest.status, 200)
    const firstOtp = otpFrom(await waitForEmail(0))
    assert.match(firstOtp, /^\d{6}$/)
    assert.notEqual(firstOtp, '123456', 'The old hardcoded OTP must be gone')

    const stored = await redis.get(`password-reset:otp:${EMAIL}`)
    assert.ok(stored, 'The OTP must be recorded in Redis')
    assert.notEqual(stored, firstOtp, 'Redis must not hold the OTP in plain text')
    assert.match(stored, /^[0-9a-f]{64}$/, 'Redis must hold a SHA-256 digest')
    console.log('PASS a random 6-digit OTP is mailed and stored only as a hash')

    const tooSoon = await call('forgot-password', { email: EMAIL })
    assert.equal(tooSoon.status, 429, 'A resend inside the cooldown must be refused')
    console.log('PASS resend cooldown refuses a second request')

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const wrong = await call('verify-otp', { email: EMAIL, otp: '000000' === firstOtp ? '111111' : '000000' })
      assert.equal(wrong.status, 400, `Wrong OTP attempt ${attempt} must be rejected`)
    }
    const locked = await call('verify-otp', { email: EMAIL, otp: '000000' })
    assert.equal(locked.status, 429, 'Attempts beyond the limit must be refused')
    const correctButBurned = await call('verify-otp', { email: EMAIL, otp: firstOtp })
    assert.equal(correctButBurned.status, 400, 'The OTP must be discarded after the limit')
    console.log(`PASS ${MAX_ATTEMPTS} wrong guesses lock out and discard the code`)

    await sleep(COOLDOWN_SECONDS * 1000 + 200)
    const secondRequest = await call('forgot-password', { email: EMAIL })
    assert.equal(secondRequest.status, 200)
    const secondOtp = otpFrom(await waitForEmail(1))
    assert.notEqual(secondOtp, firstOtp, 'Each request must issue a fresh code')

    const verified = await call('verify-otp', { email: EMAIL, otp: secondOtp })
    assert.equal(verified.status, 200)
    const resetToken = verified.payload.data.resetToken
    assert.ok(resetToken)
    assert.equal(await redis.get(`password-reset:otp:${EMAIL}`), null, 'A used OTP must be cleared')
    console.log('PASS a fresh OTP verifies once and is consumed')

    const reset = await call('reset-password', {
      resetToken, newPassword: NEW_PASSWORD, confirmPassword: NEW_PASSWORD,
    })
    assert.equal(reset.status, 200)

    const replay = await call('reset-password', {
      resetToken, newPassword: 'yet-another-pass', confirmPassword: 'yet-another-pass',
    })
    assert.equal(replay.status, 400, 'A reset token must not work twice')

    assert.equal((await call('login', { email: EMAIL, password: ORIGINAL_PASSWORD })).status, 401)
    assert.equal((await call('login', { email: EMAIL, password: NEW_PASSWORD })).status, 200)
    console.log('PASS the password is changed, the token is single use, and login follows')

    console.log('\nAll password reset checks passed.')
  } finally {
    stopChildren('SIGTERM')
    await redis.flushdb()
    redis.disconnect()
    await db.query('DELETE FROM users WHERE email = $1', [EMAIL])
    await db.end()
    await new Promise(resolve => smtp.close(resolve))
  }
}

main().then(() => process.exit(0)).catch(error => {
  console.error(error)
  stopChildren('SIGKILL')
  process.exit(1)
})
