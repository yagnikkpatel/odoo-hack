import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// All upstream responses and cookie reads are mocked: no real account, email,
// password, server, database, or Redis state is touched by this suite.
const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const modules = new Map()
const cookieJar = new Map()
const originalFetch = globalThis.fetch
const originalNodeEnv = process.env.NODE_ENV
process.env.NODE_ENV = 'production'
const mocks = {
  'server-only': {},
  react: { cache: callback => callback },
  'next/headers': {
    cookies: async () => ({ get: name => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined) })
  },
  'next/navigation': {
    redirect: location => {
      throw new Error(`redirect:${location}`)
    }
  }
}
function load(relative) {
  let file = path.resolve(root, relative)
  if (!fs.existsSync(file)) file += '.ts'
  if (modules.has(file)) return modules.get(file).exports
  const loaded = { exports: {} }
  modules.set(file, loaded)
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText
  const localRequire = spec =>
    Object.hasOwn(mocks, spec)
      ? mocks[spec]
      : spec.startsWith('@/')
        ? load(spec.slice(2))
        : spec.startsWith('.')
          ? load(path.resolve(path.dirname(file), spec))
          : requirePackage(spec)
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
  return loaded.exports
}
let assertions = 0
const expect = (actual, expected) => {
  assert.deepEqual(actual, expected)
  assertions++
}
const check = value => {
  assert.ok(value)
  assertions++
}
const user = { id: 'real-user-id', email: 'account@example.com', role: 'hr_manager', name: 'Current account' }
const jwt = expiry =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ exp: expiry })).toString('base64url')}.signature`
const token = jwt(Math.floor(Date.now() / 1000) + 900)
const resetToken = 'a'.repeat(64)
const credentials = { email: ' Account@Example.com ', password: 'test-password-only', rememberMe: true }
const routes = Object.fromEntries(
  ['login', 'logout', 'session', 'forgot-password', 'verify-otp', 'reset-password'].map(name => [
    name,
    load(`app/api/auth/${name}/route.ts`)
  ])
)
const { SESSION_COOKIE_NAME, PASSWORD_RESET_COOKIE_NAME } = load('features/auth/auth-constants.ts')
const { tokenLifetime, readVerifiedUser, AuthServiceUnavailableError } = load('features/auth/auth-server.ts')
const { getSession, verifySession } = load('features/auth/session.ts')
let calls = []
let queue = []
globalThis.fetch = async (url, options) => {
  calls.push({ url, options })
  assert.equal(options.cache, 'no-store')
  assert.equal(options.redirect, 'error')
  assert.ok(options.signal instanceof AbortSignal)
  const next = queue.shift()
  if (!next) throw new Error('Unexpected upstream call')
  if (next instanceof Error) throw next
  return new Response(next.raw ?? JSON.stringify(next.body), {
    status: next.status ?? 200,
    headers: { 'content-type': 'application/json' }
  })
}
function setup(...responses) {
  calls = []
  queue = responses
}
function request(name, body = {}, headers = {}) {
  return new Request(`https://peoplepay.example/api/auth/${name}`, {
    method: 'POST',
    headers: { origin: 'https://peoplepay.example', 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body)
  })
}
const successfulLogin = () => ({ body: { success: true, data: { accessToken: token, user } } })
const successfulMe = () => ({ body: { success: true, data: { user } } })
function sessionCookie(response) {
  return response.cookies.get(SESSION_COOKIE_NAME)
}

try {
  for (const name of ['login', 'logout', 'forgot-password', 'verify-otp', 'reset-password']) {
    setup()
    expect((await routes[name].POST(request(name, {}, { origin: 'https://attacker.example' }))).status, 403)
    expect((await routes[name].POST(request(name, {}, { origin: '' }))).status, 403)
    expect((await routes[name].POST(request(name, {}, { 'sec-fetch-site': 'cross-site' }))).status, 403)
    expect(calls.length, 0)
  }
  for (const input of [
    null,
    [],
    {},
    { ...credentials, email: 'not-email' },
    { ...credentials, rememberMe: 'true' },
    { ...credentials, password: '' },
    { ...credentials, password: 'a'.repeat(20_000) }
  ]) {
    setup()
    expect((await routes.login.POST(request('login', input))).status, 400)
    expect(calls.length, 0)
  }
  setup()
  expect(
    (
      await routes.login.POST(
        new Request('https://peoplepay.example/api/auth/login', {
          method: 'POST',
          headers: { origin: 'https://peoplepay.example', 'content-type': 'application/json' },
          body: '{invalid'
        })
      )
    ).status,
    400
  )
  expect((await routes.login.POST(request('login', credentials, { 'content-type': 'text/plain' }))).status, 400)

  setup(successfulLogin(), successfulMe())
  let response = await routes.login.POST(request('login', credentials))
  expect(response.status, 200)
  expect(await response.json(), { success: true })
  expect(calls.length, 2)
  expect(JSON.parse(calls[0].options.body), { email: 'account@example.com', password: credentials.password })
  check(calls[0].url.endsWith('/api/auth/login'))
  check(calls[1].url.endsWith('/api/auth/me'))
  expect(calls[1].options.headers.Authorization, `Bearer ${token}`)
  const cookie = sessionCookie(response)
  expect(cookie.value, token)
  expect(cookie.httpOnly, true)
  expect(cookie.secure, true)
  expect(cookie.sameSite, 'lax')
  expect(cookie.path, '/')
  check(cookie.maxAge > 0 && cookie.maxAge <= 900)
  check(response.headers.get('cache-control').includes('no-store'))

  setup(successfulLogin(), successfulMe())
  response = await routes.login.POST(request('login', { ...credentials, rememberMe: false }))
  expect(sessionCookie(response).maxAge, undefined)
  expect(sessionCookie(response).expires, undefined)

  for (const status of [401, 403, 429]) {
    setup({ status, body: { message: 'secret database connection string' } })
    response = await routes.login.POST(request('login', credentials))
    expect(response.status, status)
    check(!(await response.text()).includes('secret'))
    expect(sessionCookie(response), undefined)
  }
  for (const body of [
    null,
    {},
    { success: false },
    { success: true, data: { accessToken: token, user: { ...user, role: 'superuser' } } },
    { success: true, data: { accessToken: jwt(1), user } },
    { success: true, data: { accessToken: 'not-a-token', user } }
  ]) {
    setup({ body })
    response = await routes.login.POST(request('login', credentials))
    expect(response.status, 502)
    expect(sessionCookie(response), undefined)
  }
  setup(successfulLogin(), { status: 401, body: {} })
  expect((await routes.login.POST(request('login', credentials))).status, 401)
  setup(successfulLogin(), { body: { success: true, data: { user: { ...user, id: 'other-account' } } } })
  expect((await routes.login.POST(request('login', credentials))).status, 502)
  setup(new DOMException('upstream timeout', 'TimeoutError'))
  expect((await routes.login.POST(request('login', credentials))).status, 503)
  setup(successfulLogin(), { status: 500, body: { message: 'private failure' } })
  expect((await routes.login.POST(request('login', credentials))).status, 503)
  expect(tokenLifetime('x.e30.x'), null)
  expect(tokenLifetime(jwt(42), 40_000), 2)
  expect(tokenLifetime(jwt(42), 42_000), null)

  cookieJar.clear()
  setup()
  expect(await getSession(), null)
  await assert.rejects(verifySession(), /redirect:\/login/)
  expect(calls.length, 0)
  response = await routes.session.GET()
  expect(response.status, 401)
  expect(sessionCookie(response).maxAge, 0)
  cookieJar.set(SESSION_COOKIE_NAME, token)
  setup(successfulMe())
  response = await routes.session.GET()
  expect(await response.json(), { success: true, data: { user } })
  for (const status of [401, 403]) {
    setup({ status, body: {} })
    response = await routes.session.GET()
    expect(response.status, 401)
    expect(sessionCookie(response).maxAge, 0)
  }
  for (const upstream of [
    { status: 503, body: {} },
    { body: { success: true, data: { user: { id: 'fake' } } } },
    new Error('ECONNREFUSED')
  ]) {
    setup(upstream)
    response = await routes.session.GET()
    expect(response.status, 503)
    expect(sessionCookie(response), undefined)
  }
  setup({ status: 500, body: {} })
  await assert.rejects(readVerifiedUser(token), AuthServiceUnavailableError)

  setup({ body: { success: true, message: 'Backend can vary copy' } })
  response = await routes['forgot-password'].POST(request('forgot-password', { email: 'Account@Example.com' }))
  expect(response.status, 200)
  check((await response.json()).message.includes('If this account exists'))
  expect(response.cookies.get(PASSWORD_RESET_COOKIE_NAME).maxAge, 0)
  expect(JSON.parse(calls[0].options.body), { email: 'account@example.com' })

  setup()
  expect((await routes['verify-otp'].POST(request('verify-otp', { email: user.email, otp: '123' }))).status, 400)
  expect(calls.length, 0)
  setup({ body: { success: true, data: { resetToken, expiresInSeconds: 900 } } })
  response = await routes['verify-otp'].POST(request('verify-otp', { email: user.email, otp: '123456' }))
  expect(response.status, 200)
  expect(await response.json(), { success: true })
  const recoveryCookie = response.cookies.get(PASSWORD_RESET_COOKIE_NAME)
  expect(recoveryCookie.value, resetToken)
  expect(recoveryCookie.maxAge, 600)
  expect(recoveryCookie.httpOnly, true)
  expect(recoveryCookie.secure, true)
  setup({ body: { success: true, data: { resetToken: 'bad', expiresInSeconds: 0 } } })
  expect((await routes['verify-otp'].POST(request('verify-otp', { email: user.email, otp: '123456' }))).status, 502)

  const passwords = { newPassword: 'new-test-password', confirmPassword: 'new-test-password' }
  cookieJar.delete(PASSWORD_RESET_COOKIE_NAME)
  setup()
  expect((await routes['reset-password'].POST(request('reset-password', { ...passwords, resetToken }))).status, 401)
  expect(calls.length, 0)
  cookieJar.set(PASSWORD_RESET_COOKIE_NAME, resetToken)
  setup()
  expect(
    (await routes['reset-password'].POST(request('reset-password', { ...passwords, confirmPassword: 'different' })))
      .status,
    400
  )
  expect(calls.length, 0)
  setup({ body: { success: true } })
  response = await routes['reset-password'].POST(request('reset-password', passwords))
  expect(response.status, 200)
  expect(JSON.parse(calls[0].options.body), { ...passwords, resetToken })
  expect(sessionCookie(response).maxAge, 0)
  expect(response.cookies.get(PASSWORD_RESET_COOKIE_NAME).maxAge, 0)
  check(!(await response.text()).includes(resetToken))
  setup({ status: 400, body: {} })
  response = await routes['reset-password'].POST(request('reset-password', passwords))
  expect(response.status, 400)
  expect(response.cookies.get(PASSWORD_RESET_COOKIE_NAME).maxAge, 0)

  setup()
  response = await routes.logout.POST(request('logout'))
  expect(response.status, 200)
  expect(sessionCookie(response).maxAge, 0)
  expect(response.cookies.get(PASSWORD_RESET_COOKIE_NAME).maxAge, 0)
  expect(calls.length, 0)
  console.log(`Auth bridge: ${assertions} assertions passed (mocked upstream only).`)
} finally {
  globalThis.fetch = originalFetch
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
}
