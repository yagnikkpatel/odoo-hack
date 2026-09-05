import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import ts from "typescript";

const root = fileURLToPath(new URL("../", import.meta.url));
const requirePackage = createRequire(import.meta.url);
const cache = new Map();
const calls = [];
let list = async () => ({ attendances: [], pagination: { hasMore: false } });
const service = {
  listAttendances: async (query, signal) => {
    calls.push(query);
    return list(query, signal);
  },
};

function load(relative) {
  let file = path.resolve(root, relative);
  if (!existsSync(file)) file += ".ts";
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const code = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const localRequire = (name) => {
    if (name === "./service" && file.endsWith("records-query.ts"))
      return service;
    if (name.startsWith("@/")) return load(name.slice(2));
    if (name.startsWith("."))
      return load(path.resolve(path.dirname(file), name));
    return requirePackage(name);
  };
  new Function("require", "module", "exports", code)(
    localRequire,
    module,
    module.exports,
  );
  return module.exports;
}

const { calendarDateRange, loadAllAttendanceRecords } = load(
  "features/attendance/records-query",
);
assert.deepEqual(calendarDateRange("2026-09"), {
  from: "2026-08-31",
  to: "2026-10-04",
});
assert.deepEqual(calendarDateRange("2024-02"), {
  from: "2024-01-29",
  to: "2024-03-03",
});
assert.deepEqual(calendarDateRange("2026-02"), {
  from: "2026-01-26",
  to: "2026-03-01",
});
assert.deepEqual(calendarDateRange("invalid"), calendarDateRange(""));

const records = Array.from({ length: 231 }, (_, index) => ({
  id: String(index),
}));
list = async ({ offset, limit }) => ({
  attendances: records.slice(offset, offset + limit),
  pagination: { total: records.length, hasMore: offset + limit < records.length },
});
const query = {
  scope: "all",
  limit: 15,
  offset: 75,
  status: "absent",
  employeeId: "employee-1",
  search: "Ada",
  from: "2026-08-31",
  to: "2026-10-04",
};
assert.deepEqual(await loadAllAttendanceRecords(query), records);
// Page 0 is fetched alone (its total tells us how many pages remain), then
// every remaining page is requested together instead of one after another.
assert.deepEqual(
  calls.map((call) => call.offset),
  [0, 100, 200],
);
for (const call of calls)
  assert.deepEqual(call, { ...query, limit: 100, offset: call.offset });

calls.length = 0;
const own = {
  scope: "own",
  limit: 10,
  offset: 0,
  status: "present",
  from: "2026-09-01",
  to: "2026-09-02",
};
await loadAllAttendanceRecords(own);
for (const call of calls) {
  assert.equal(call.scope, "own");
  assert.equal(call.status, "present");
  assert.equal("search" in call, false);
  assert.equal("employeeId" in call, false);
}

calls.length = 0;
assert.deepEqual(
  await loadAllAttendanceRecords({
    ...query,
    from: "2026-11-01",
    to: "2026-10-04",
  }),
  [],
);
assert.equal(calls.length, 0);
// A declared total larger than what the pages actually deliver (e.g. a row
// deleted mid-fetch) must surface as an error, not a silently short list.
list = async ({ offset }) => ({
  attendances: offset === 0 ? [{ id: "first" }] : [],
  pagination: { total: 150 },
});
await assert.rejects(
  loadAllAttendanceRecords(query),
  /Not all attendance records/,
);

list = async ({ offset }) => {
  if (offset) throw new Error("Second page unavailable");
  return { attendances: [{ id: "first" }], pagination: { total: 101 } };
};
await assert.rejects(
  loadAllAttendanceRecords(query),
  /Second page unavailable/,
);

const controller = new AbortController();
let release;
list = async () =>
  new Promise((resolve) => {
    release = resolve;
  });
const obsolete = loadAllAttendanceRecords(query, controller.signal);
controller.abort();
release({ attendances: [{ id: "obsolete" }], pagination: { hasMore: false } });
await assert.rejects(obsolete, { name: "AbortError" });
const before = calls.length;
await assert.rejects(loadAllAttendanceRecords(query, controller.signal), {
  name: "AbortError",
});
assert.equal(calls.length, before);

const { attendanceCsvRows } = load("features/attendance/csv");
const record = {
  id: "record",
  employeeId: "employee",
  employeeName: "=SUM(1,2)",
  employeeEmail: "+ada@example.test",
  attendanceDate: "2026-09-01",
  checkIn: null,
  checkOut: null,
  workedHours: 0,
  overtimeHours: 0,
  status: "absent",
  editedByName: " @admin",
  editedAt: "2026-09-01T12:00:00Z",
  editReason: "-formula",
};
const csv = attendanceCsvRows([record])[0];
assert.equal(csv.Employee, "'=SUM(1,2)");
assert.equal(csv.Email, "'+ada@example.test");
assert.equal(csv["Edited by"], "' @admin");
assert.equal(csv["Edit reason"], "'-formula");
assert.equal(csv["Check in (ISO timestamp)"], "");
assert.equal(csv["Attendance date (IST)"], "2026-09-01");
assert.equal(csv["Worked hours"], 0);
assert.equal(csv.Status, "Absent");
assert.equal("Break minutes" in csv, false);
assert.equal("Corrections" in csv, false);

const read = (file) =>
  readFileSync(path.join(root, file), "utf8")
    .replaceAll('"', "'")
    .replace(/\s+/g, " ");
const table = read("features/attendance/use-attendance-table.ts");
assert.match(table, /scope === 'all' && search\.trim\(\)/);
assert.match(table, /scope === 'all' && employeeId/);
assert.match(table, /manualFiltering: true, manualPagination: true/);
assert.match(table, /calendar \? monthData\.records\.length/);
assert.match(table, /exportQuery: calendar \? calendarQuery : query/);
assert.match(table, /return \(\) => controller\.abort\(\)/);
assert.match(
  table,
  /result\.revision === revision && result\.attempt === attempt/,
);
const today = read("features/attendance/today-card.tsx");
assert.doesNotMatch(today, /Close an earlier session|Still checked in from an earlier day|recovery/);
assert.match(today, /!initialLoading && \(!today \|\| open\)/);
assert.match(today, /Attendance unavailable/);
assert.doesNotMatch(today, /<details/);
assert.match(today, /window\.addEventListener\('focus', refresh\)/);
assert.doesNotMatch(
  read("features/attendance/index.tsx"),
  /DataConnectionNotice|useEmployeesStore|workedMinutes|breakMinutes|corrections/,
);
console.log(
  "Attendance directory tests passed: complete pagination, month boundaries, cancellation, errors, scopes, CSV, and self-service controls.",
);
