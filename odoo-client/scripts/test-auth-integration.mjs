import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server.js'

const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const modules = new Map()
const read = file => readFileSync(root + file, 'utf8')
function load(relative) {
  let file = path.resolve(root, relative)
  if (!existsSync(file)) file += existsSync(file + '.ts') ? '.ts' : '.tsx'
  if (modules.has(file)) return modules.get(file).exports
  const loadedModule = { exports: {} }
  modules.set(file, loadedModule)
  const source = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
  }).outputText
  const requireLocal = spec =>
    spec === 'server-only'
      ? {}
      : spec.startsWith('@/')
        ? load(spec.slice(2))
        : spec.startsWith('.')
          ? load(path.resolve(path.dirname(file), spec))
          : requirePackage(spec)
  new Function('require', 'module', 'exports', source)(requireLocal, loadedModule, loadedModule.exports)
  return loadedModule.exports
}

const { proxy } = load('proxy.ts')
const { SESSION_COOKIE_NAME } = load('features/auth/auth-constants.ts')
for (const route of [
  '/employees',
  '/employees/record',
  '/contracts',
  '/attendance',
  '/kanban',
  '/payroll',
  '/time-off/requests'
]) {
  const response = proxy(new NextRequest('https://peoplepay.example' + route))
  assert.equal(response.headers.get('location'), 'https://peoplepay.example/login')
}
// An opaque cookie only passes the cheap proxy gate, not backend verification.
const headers = { cookie: `${SESSION_COOKIE_NAME}=not-a-verified-token` }
assert.equal(
  proxy(new NextRequest('https://peoplepay.example/employees', { headers })).headers.get('x-middleware-next'),
  '1'
)
assert.equal(
  proxy(new NextRequest('https://peoplepay.example/payroll', { headers })).headers.get('location'),
  'https://peoplepay.example/employees'
)
assert.match(read('app/(app)/layout.tsx'), /await verifySession\(\)/)
assert.match(read('app/(app)/layout.tsx'), /<SessionGuard user=\{user\}/)
assert.match(read('app/(app)/layout.tsx'), /<AppRecordsProvider key=\{user.id\} user=\{user\}/)
assert.match(read('app/(auth)/login/page.tsx'), /await getSession\(\)/)
assert.equal(existsSync(root + 'features/auth/auth-config.ts'), false)
assert.equal(existsSync(root + 'features/nexacrm/providers/demo-records-provider.tsx'), false)

const verifiedUser = {
  id: 'test-current-user',
  email: 'verified@example.invalid',
  name: 'Verified account',
  role: 'hr_manager'
}
const { useUsersStore } = load('features/nexacrm/store/use-users-store.ts')
useUsersStore.getState().initialize([{ ...verifiedUser, email: 'changed-locally@example.invalid', role: 'admin' }])
const { CurrentUserProvider, useCurrentUser } = load('features/nexacrm/contexts/currentUserContext.tsx')
function Probe() {
  const context = useCurrentUser()
  assert.deepEqual(context.user, verifiedUser, 'local store updates cannot replace the verified auth identity')
  assert.equal(Object.hasOwn(context, 'setCurrentUser'), false, 'no local impersonation setter')
  assert.equal(context.can('records:read'), true)
  for (const permission of [
    'records:create',
    'records:update',
    'records:delete',
    'members:manage',
    'settings:manage'
  ]) {
    assert.equal(context.can(permission), false, 'disconnected write must be unavailable: ' + permission)
  }
  return React.createElement('span', null, context.user.email)
}
assert.match(
  renderToStaticMarkup(React.createElement(CurrentUserProvider, { user: verifiedUser }, React.createElement(Probe))),
  /verified@example.invalid/
)

const provider = read('features/nexacrm/providers/app-records-provider.tsx')
assert.match(provider, /UsersStoreHydrator data=\{\[user\]\}/)
assert.match(provider, /<DataStoresInitializer/)
assert.doesNotMatch(provider, /getPeople|getCompanies|getCurrentUser|fake-db|fetch\(/)
const login = read('features/auth/components/login-form.tsx')
assert.match(login, /await login\(formState\)/)
assert.match(login, /window.location.assign\(siteConfig.authenticatedHome\)/)
assert.doesNotMatch(login, /noValidate|previewEnabled|30 days/)
const sidebar = read('components/layout/app-sidebar.tsx')
assert.match(sidebar, /await logout\(\)/)
assert.match(sidebar, /window.location.replace\(['"]\/login['"]\)/)
const guard = read('features/auth/components/session-guard.tsx')
assert.match(guard, /\/api\/auth\/session/)
assert.match(guard, /response.status === 401/)
assert.match(guard, /visibilitychange/)
assert.match(guard, /SessionUnavailable/)

for (const directory of ['app', 'components', 'features', 'lib', 'config']) {
  for (const file of readdirSync(root + directory, { recursive: true }).filter(name => /\.tsx?$/.test(name))) {
    const source = read(directory + '/' + file)
    assert.doesNotMatch(
      source,
      /fake-db|createDemo\w*|previewUser|previewEnabled|from ['"][^'"]*scripts\/fixtures/,
      `${directory}/${file} must not generate or import fake data`
    )
  }
}
console.log(
  'PASS: authenticated route wiring, verified identity isolation, disabled disconnected writes, login/logout document reset, session guard and no runtime demo imports.'
)
