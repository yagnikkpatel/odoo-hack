import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Unit tests with mocked HTTP and isolated dialog state; no live user is created.
const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const originalFetch = globalThis.fetch
const account = { id: '11111111-1111-4111-8111-111111111111', name: 'New employee', email: 'new@example.invalid', role: 'employee', status: 'active' }
const input = { name: account.name, email: account.email, password: 'test-password-only', role: 'employee' }
let cookie = 'test-session'
let actorRole = 'admin'
let calls = []
let upstream = { status: 201, body: { success: true, data: account } }

function loader(mocks = {}) {
  const modules = new Map()
  function load(relative) {
    let file = path.resolve(root, relative)
    if (!fs.existsSync(file)) {
      if (fs.existsSync(file + '.ts')) file += '.ts'
      else file += '.tsx'
    }
    if (modules.has(file)) return modules.get(file).exports
    const loaded = { exports: {} }
    modules.set(file, loaded)
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
    }).outputText
    function localRequire(name) {
      if (Object.hasOwn(mocks, name)) return mocks[name]
      if (name.startsWith('@/')) return load(name.slice(2))
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name))
      return requirePackage(name)
    }
    new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports)
    return loaded.exports
  }
  return load
}

const load = loader({
  'server-only': {},
  'next/headers': { cookies: async () => ({ get: () => {
    if (cookie) return { value: cookie }
    return undefined
  } }) }
})
globalThis.fetch = async (url, options) => {
  if (String(url).endsWith('/auth/me')) {
    return new Response(JSON.stringify({ success: true, data: { user: { ...account, role: actorRole } } }))
  }
  calls.push({ url, options })
  return new Response(JSON.stringify(upstream.body), { status: upstream.status })
}
const { POST } = load('app/api/users/route.ts')
const { parseCreateUserInput, parseCreatedUser } = load('features/users/validation.ts')
function request(body = input, origin = 'https://peoplepay.example') {
  return new Request('https://peoplepay.example/api/users', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  })
}
try {
  assert.equal((await POST(request(input, 'https://untrusted.example'))).status, 403)
  cookie = ''
  assert.equal((await POST(request())).status, 401)
  cookie = 'test-session'
  for (const role of ['employee', 'hr_manager', 'hr_payroll_user', 'hr_payroll_manager']) {
    actorRole = role
    assert.equal((await POST(request())).status, 403)
  }
  assert.equal(calls.length, 0)
  actorRole = 'admin'
  for (const invalid of [{}, { ...input, role: 'admin' }, { ...input, email: 'bad' }, { ...input, password: 'short' }, { ...input, status: 'inactive' }]) {
    assert.equal(parseCreateUserInput(invalid), null)
    assert.equal((await POST(request(invalid))).status, 400)
  }
  upstream.body.data = { ...account, password_hash: 'must-not-leak', accessToken: 'must-not-leak' }
  const success = await POST(request())
  assert.equal(success.status, 201)
  assert.deepEqual((await success.json()).data, account)
  assert.match(success.headers.get('cache-control'), /no-store/)
  assert.match(calls[0].url, /\/api\/users$/)
  assert.deepEqual(JSON.parse(calls[0].options.body), input)
  assert.equal(calls[0].options.headers.Authorization, 'Bearer test-session')
  assert.equal(calls[0].options.redirect, 'error')
  assert.equal(parseCreatedUser({ ...account, role: 'admin' }), null)
  upstream = { status: 409, body: { message: 'private upstream error' } }
  const conflict = await POST(request())
  assert.equal(conflict.status, 409)
  assert.match((await conflict.json()).message, /Link existing account/)
  upstream = { status: 500, body: { message: 'private upstream error' } }
  assert.doesNotMatch(await (await POST(request())).text(), /private upstream/)
  console.log('PASS: existing user endpoint forwarding, admin-only creation, input validation, duplicate-email guidance and secret-free responses.')
} finally {
  globalThis.fetch = originalFetch
}

// Exercise the actual dialog's transitions without rendering warehouse portals.
function dialogHarness(role) {
  const state = []
  let cursor = 0
  const accountForm = () => null
  const profileForm = () => null
  const primitive = () => null
  const closes = []
  const created = []
  const useState = initial => {
    const index = cursor++
    if (!(index in state)) state[index] = initial
    return [state[index], next => {
      if (typeof next === 'function') state[index] = next(state[index])
      else state[index] = next
    }]
  }
  const componentLoad = loader({
    react: { useState },
    '@/features/nexacrm/components/ui/button': { Button: primitive },
    '@/features/nexacrm/components/ui/dialog': Object.fromEntries(['Dialog', 'DialogContent', 'DialogDescription', 'DialogHeader', 'DialogTitle'].map(name => [name, primitive])),
    '@/features/nexacrm/contexts/currentUserContext': { useCurrentUser: () => ({ user: { role } }) },
    '../permissions': { useEmployeePermissions: () => ({ canCreate: true }) },
    './profile-form': { default: profileForm },
    './create-account-form': { default: accountForm }
  })
  const Component = componentLoad('features/employees/components/create-employee-dialog.tsx').default
  function render(open = true) {
    cursor = 0
    return Component({ open, onOpenChange: value => closes.push(value), onCreate: id => created.push(id) })
  }
  function find(node, type) {
    if (!node || typeof node !== 'object') return undefined
    if (node.type === type) return node
    for (const child of [node.props?.children].flat(Infinity)) {
      const match = find(child, type)
      if (match) return match
    }
    return undefined
  }
  return { render, find, accountForm, profileForm, closes, created }
}
const dialog = dialogHarness('admin')
let tree = dialog.render()
assert.ok(dialog.find(tree, dialog.accountForm), 'Admin starts with name/email/password account creation')
assert.equal(dialog.find(tree, dialog.profileForm), undefined)
dialog.find(tree, dialog.accountForm).props.onCreated(account)
tree = dialog.render()
assert.equal(dialog.find(tree, dialog.accountForm), undefined, 'Step two must never recreate the account')
assert.equal(dialog.find(tree, dialog.profileForm).props.account.id, account.id)
dialog.find(tree, dialog.profileForm).props.onCancel()
dialog.render(false)
tree = dialog.render(true)
assert.equal(dialog.find(tree, dialog.profileForm).props.account.id, account.id, 'Closing and reopening retains the saved account')
dialog.find(tree, dialog.profileForm).props.onSaved(account.id)
assert.deepEqual(dialog.created, [account.id])
assert.ok(dialog.find(dialog.render(), dialog.accountForm), 'Success resets the next new-employee flow')
const hr = dialogHarness('hr_manager')
assert.ok(hr.find(hr.render(), hr.profileForm))
assert.equal(hr.find(hr.render(), hr.accountForm), undefined, 'HR keeps linking without gaining user-create permission')
console.log('PASS: two-step dialog, saved ID reuse, close/resume, completion reset, and HR linking-only flow (isolated component-state tests).')
