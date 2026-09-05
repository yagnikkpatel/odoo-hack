import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

// Isolated regression tests for the real native store and service. Every HTTP
// response below is a test fixture; no server, account, or upload service is used.
const root = fileURLToPath(new URL('../', import.meta.url))
const requirePackage = createRequire(import.meta.url)
const employeeId = '11111111-1111-4111-8111-111111111111'
const employeePath = '/api/employees/' + employeeId
const directoryPath = '/api/employees?limit=15&offset=0'
const query = { limit: 15, offset: 0 }
const originalEmployee = {
  userId: employeeId,
  name: 'Store Regression Employee',
  email: 'employee-store-test@example.invalid',
  role: 'employee',
  status: 'active',
  jobPosition: 'Engineer',
  contact: '+10000000000',
  department: 'Engineering',
  managerId: null,
  managerName: null,
  workingSchedule: 'Weekdays',
  company: 'Test company',
  workLocation: 'Office',
  location: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function deferred() {
  let resolve
  const promise = new Promise((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

function response(data, status = 200) {
  if (status >= 400) {
    return new Response(JSON.stringify({ success: false, message: data }), {
      status,
    })
  }
  return new Response(JSON.stringify({ success: true, data }), { status })
}

function directory(employees) {
  return {
    employees,
    pagination: {
      total: employees.length,
      limit: 15,
      offset: 0,
      hasMore: false,
    },
    summary: {
      total: employees.length,
      active: employees.length,
      departments: 1,
      locations: 1,
      withManager: 0,
      withoutManager: employees.length,
    },
  }
}

function createHarness() {
  // Each case gets new module-level request counters, caches, and native state.
  const modules = new Map()
  function load(relative) {
    let file = path.resolve(root, relative)
    if (!fs.existsSync(file)) file += '.ts'
    if (modules.has(file)) return modules.get(file).exports
    const loaded = { exports: {} }
    modules.set(file, loaded)
    const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText
    function localRequire(specifier) {
      if (specifier.startsWith('@/')) return load(specifier.slice(2))
      if (specifier.startsWith('.'))
        return load(path.resolve(path.dirname(file), specifier))
      return requirePackage(specifier)
    }
    new Function('require', 'module', 'exports', compiled)(
      localRequire,
      loaded,
      loaded.exports,
    )
    return loaded.exports
  }

  const queue = []
  const calls = []
  const previousFetch = globalThis.fetch
  globalThis.fetch = async (url, options) => {
    const expected = queue.shift()
    assert.ok(expected, 'Unexpected employee API request: ' + url)
    assert.equal(String(url), expected.url)
    assert.equal(options.method || 'GET', expected.method)
    assert.equal(options.credentials, 'same-origin')
    assert.equal(options.cache, 'no-store')
    calls.push({ url: String(url), options })
    return expected.result
  }
  const { useEmployeesStore } = load('features/employees/store.ts')
  const { mapEmployee } = load('features/employees/employee-mapper.ts')

  return {
    state: () => useEmployeesStore.getState(),
    mapEmployee,
    calls,
    enqueue(url, result, method = 'GET') {
      queue.push({ url, result, method })
    },
    assertComplete() {
      assert.equal(queue.length, 0, 'All expected requests must run')
    },
    restore() {
      globalThis.fetch = previousFetch
    },
  }
}

async function testFirstDirectoryLoadCannotOverwriteSavedProfile() {
  const test = createHarness()
  const initialResponse = deferred()
  let initialLoad
  try {
    test.enqueue(directoryPath, initialResponse.promise)
    initialLoad = test.state().loadEmployees(query)
    assert.equal(test.state().hasHydrated, false)
    assert.equal(test.state().isLoading, true)
    const initialSignal = test.calls[0].options.signal

    // The preview can finish loading before the first paginated list does.
    test.enqueue(employeePath, response(originalEmployee))
    await test.state().loadEmployee(employeeId)
    const updated = { ...originalEmployee, department: 'Finance' }
    test.enqueue(employeePath, response(updated), 'PATCH')
    test.enqueue(directoryPath, response(directory([updated])))
    await test.state().updateEmployee(employeeId, { department: 'Finance' })

    assert.equal(
      initialSignal.aborted,
      true,
      'Saving must supersede an in-flight first list request',
    )
    assert.equal(test.state().hasHydrated, true)
    assert.equal(test.state().details[employeeId].department, 'Finance')

    // Deliberately deliver the old response despite abort, as a transport/cache
    // may already have completed. Request numbering must still reject it.
    initialResponse.resolve(response(directory([originalEmployee])))
    await initialLoad
    assert.equal(test.state().employees[0].department, 'Finance')
    assert.equal(test.state().details[employeeId].department, 'Finance')
    assert.equal(test.state().isLoading, false)
    test.assertComplete()
    console.log(
      'PASS: a delayed initial list cannot overwrite a newer saved profile.',
    )
  } finally {
    initialResponse.resolve(response(directory([originalEmployee])))
    if (initialLoad) await initialLoad.catch(() => {})
    test.restore()
  }
}

async function testStale404CannotEvictSavedProfile() {
  const test = createHarness()
  const outdatedResponse = deferred()
  let oldResult
  try {
    test.enqueue(employeePath, outdatedResponse.promise)
    oldResult = test
      .state()
      .loadEmployee(employeeId)
      .then(
        () => null,
        (error) => error,
      )
    const created = { ...originalEmployee, department: 'New department' }
    test.enqueue(employeePath, response(created, 201), 'POST')
    const savedId = await test.state().addEmployee({
      userId: employeeId,
      jobPosition: created.jobPosition,
      department: created.department,
      contact: created.contact,
      workingSchedule: created.workingSchedule,
      companyName: created.company,
      workLocation: created.workLocation,
      managerId: null,
      location: null,
    })
    assert.equal(savedId, employeeId)
    const savedRecord = test.state().details[employeeId]

    outdatedResponse.resolve(response('Employee profile not found', 404))
    const error = await oldResult
    assert.equal(error.status, 404)
    assert.equal(
      test.state().details[employeeId],
      savedRecord,
      'An older 404 must not evict a newer confirmed save',
    )

    // A genuinely current 404 must still clear a record removed externally.
    test.enqueue(employeePath, response('Employee profile not found', 404))
    await assert.rejects(test.state().loadEmployee(employeeId), { status: 404 })
    assert.equal(test.state().details[employeeId], undefined)
    test.assertComplete()
    console.log(
      'PASS: stale 404 responses preserve newer saves; current 404s clear missing profiles.',
    )
  } finally {
    outdatedResponse.resolve(response('Employee profile not found', 404))
    if (oldResult) await oldResult
    test.restore()
  }
}

async function testConfirmedImageWritesSurviveRefreshFailure() {
  const test = createHarness()
  const uploadResponse = deferred()
  let upload
  try {
    const oldAvatar = {
      imageId: 'old-photo',
      imageUrl: 'https://images.example.invalid/old.png',
    }
    const companyImage = {
      imageId: 'company-logo',
      imageUrl: 'https://images.example.invalid/company.png',
    }
    const employeeImage = {
      imageId: 'new-photo',
      imageUrl: 'https://images.example.invalid/new.png',
    }
    test
      .state()
      .initialize([
        test.mapEmployee({
          ...originalEmployee,
          employeeImage: oldAvatar,
          companyImage,
        }),
      ])
    const images = new FormData()
    images.append(
      'employeeImage',
      new Blob(['test-only image'], { type: 'image/png' }),
      'test.png',
    )

    test.enqueue(employeePath + '/images', uploadResponse.promise, 'POST')
    test.enqueue(
      directoryPath,
      response('Directory temporarily unavailable', 503),
    )
    upload = test.state().uploadImages(employeeId, images)
    assert.equal(
      test.state().details[employeeId].avatar,
      oldAvatar.imageUrl,
      'Never preview an unconfirmed upload as saved',
    )
    uploadResponse.resolve(
      response({ userId: employeeId, employeeImage, companyImage }),
    )
    await assert.doesNotReject(
      upload,
      'A confirmed upload must remain successful if directory refresh fails',
    )
    assert.equal(
      test.state().details[employeeId].avatar,
      employeeImage.imageUrl,
    )
    assert.equal(test.state().employees[0].avatar, employeeImage.imageUrl)
    assert.equal(
      test.state().details[employeeId].companyImage,
      companyImage.imageUrl,
    )
    assert.equal(test.state().error, 'Directory temporarily unavailable')

    test.enqueue(
      employeePath + '/images/employee',
      response({ userId: employeeId, companyImage }),
      'DELETE',
    )
    test.enqueue(
      directoryPath,
      response('Directory temporarily unavailable', 503),
    )
    await assert.doesNotReject(
      test.state().deleteImage(employeeId, 'employee'),
      'A confirmed image removal must survive a directory refresh failure',
    )
    assert.equal(test.state().details[employeeId].avatar, undefined)
    assert.equal(test.state().employees[0].avatar, undefined)
    assert.equal(
      test.state().details[employeeId].companyImage,
      companyImage.imageUrl,
    )
    assert.equal(
      test.calls.some((call) => call.url === employeePath),
      false,
      'Image mutations must use returned refs, not require another profile GET',
    )

    const beforeFailure = test.state().details[employeeId]
    test.enqueue(
      employeePath + '/images',
      response('Image rejected', 400),
      'POST',
    )
    await assert.rejects(
      test.state().uploadImages(employeeId, images),
      /Image rejected/,
    )
    assert.equal(
      test.state().details[employeeId],
      beforeFailure,
      'A failed upload must leave saved refs unchanged',
    )
    test.assertComplete()
    console.log(
      'PASS: confirmed image writes survive refresh errors; failed writes never change saved refs.',
    )
  } finally {
    uploadResponse.resolve(response({ userId: employeeId }))
    if (upload) await upload.catch(() => {})
    test.restore()
  }
}

await testFirstDirectoryLoadCannotOverwriteSavedProfile()
await testStale404CannotEvictSavedProfile()
await testConfirmedImageWritesSurviveRefreshFailure()
console.log(
  'PASS: employee store race regression suite (3 isolated cases, mocked HTTP only).',
)
