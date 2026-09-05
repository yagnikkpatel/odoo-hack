import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { app, auth, createTestUser, login, shutdown } from "./helpers";
import { RoleName } from "../types/user";

after(shutdown);

/** The matrix documented in api-contract.md, asserted end to end. */
const EXPECTED_COUNTS: Record<RoleName, number> = {
  employee: 6,
  hr_manager: 22,
  hr_payroll_user: 29,
  hr_payroll_manager: 35,
  admin: 37,
};

const PAYROLL_ADMIN_CODES = [
  "payrun.read",
  "payrun.write",
  "payrun.validate",
  "payrun.pay",
  "payrun.send",
  "payslip.read",
  "payslip.write",
  "salary_structure.read",
  "salary_structure.write",
  "salary_rule.read",
  "salary_rule.write",
  "dashboard.read",
];

async function permissionsFor(role: RoleName): Promise<string[]> {
  const user = await createTestUser(role);
  const res = await request(app)
    .get("/api/auth/me")
    .set(...auth(await login(user.email, user.password)));

  assert.equal(res.status, 200);

  return res.body.data.permissions;
}

describe("Permission matrix (BR-RBAC-1)", () => {
  for (const [role, count] of Object.entries(EXPECTED_COUNTS) as [RoleName, number][]) {
    it(`${role} holds exactly ${count} permissions`, async () => {
      assert.equal((await permissionsFor(role)).length, count);
    });
  }

  it("every role's grants are a subset of the next role up", async () => {
    const employee = new Set(await permissionsFor("employee"));
    const hrManager = new Set(await permissionsFor("hr_manager"));
    const payrollUser = new Set(await permissionsFor("hr_payroll_user"));
    const payrollManager = new Set(await permissionsFor("hr_payroll_manager"));
    const admin = new Set(await permissionsFor("admin"));

    for (const [lower, higher, names] of [
      [employee, hrManager, "employee ⊂ hr_manager"],
      [hrManager, payrollUser, "hr_manager ⊂ hr_payroll_user"],
      [payrollUser, payrollManager, "hr_payroll_user ⊂ hr_payroll_manager"],
      [payrollManager, admin, "hr_payroll_manager ⊂ admin"],
    ] as [Set<string>, Set<string>, string][]) {
      const missing = [...lower].filter((code) => !higher.has(code));

      assert.deepEqual(missing, [], `${names} — missing: ${missing.join(", ")}`);
    }
  });
});

describe("HR Manager has no payroll access (BR-RBAC-4)", () => {
  it("holds none of the payroll administration codes", async () => {
    const granted = new Set(await permissionsFor("hr_manager"));
    const leaked = PAYROLL_ADMIN_CODES.filter((code) => granted.has(code));

    assert.deepEqual(leaked, [], `HR Manager must not hold: ${leaked.join(", ")}`);
  });

  it("still holds full HR CRUD", async () => {
    const granted = new Set(await permissionsFor("hr_manager"));

    for (const code of [
      "employee.write",
      "employee.delete",
      "contract.write",
      "schedule.write",
      "attendance.write",
      "time_off.approve",
      "time_off_type.write",
    ]) {
      assert.ok(granted.has(code), `HR Manager should hold ${code}`);
    }
  });

  it("can still read their own payslips — own-data, not payroll administration", async () => {
    assert.ok((await permissionsFor("hr_manager")).includes("payslip.read_self"));
  });
});

describe("HR Payroll User is read-only on salary config (BR-RBAC-5)", () => {
  it("reads structures and rules but cannot write them", async () => {
    const granted = new Set(await permissionsFor("hr_payroll_user"));

    assert.ok(granted.has("salary_structure.read"));
    assert.ok(granted.has("salary_rule.read"));
    assert.ok(!granted.has("salary_structure.write"), "must not hold salary_structure.write");
    assert.ok(!granted.has("salary_rule.write"), "must not hold salary_rule.write");
  });

  it("can create and compute payruns", async () => {
    const granted = new Set(await permissionsFor("hr_payroll_user"));

    assert.ok(granted.has("payrun.read"));
    assert.ok(granted.has("payrun.write"));
    assert.ok(granted.has("payslip.write"));
  });

  it("cannot validate, pay or send — those are Payroll Manager", async () => {
    const granted = new Set(await permissionsFor("hr_payroll_user"));

    assert.ok(!granted.has("payrun.validate"));
    assert.ok(!granted.has("payrun.pay"));
    assert.ok(!granted.has("payrun.send"));
  });
});

describe("Admin endpoints reject every non-admin role", () => {
  const endpoints: [string, string][] = [
    ["get", "/api/admin/users"],
    ["post", "/api/admin/users"],
    ["get", "/api/admin/roles"],
    ["get", "/api/admin/permissions"],
  ];

  for (const role of ["employee", "hr_manager", "hr_payroll_user", "hr_payroll_manager"] as RoleName[]) {
    it(`${role} gets 403 from every admin endpoint`, async () => {
      const user = await createTestUser(role);
      const token = await login(user.email, user.password);

      for (const [method, path] of endpoints) {
        const res = await (request(app) as never as Record<string, (p: string) => request.Test>)
          [method](path)
          .set(...auth(token))
          .send({});

        assert.equal(res.status, 403, `${method.toUpperCase()} ${path} should be 403 for ${role}`);
        assert.equal(res.body.code, "forbidden");
      }
    });
  }

  it("admin gets through", async () => {
    const user = await createTestUser("admin");
    const res = await request(app)
      .get("/api/admin/roles")
      .set(...auth(await login(user.email, user.password)));

    assert.equal(res.status, 200);
  });

  it("an unauthenticated caller gets 401, not 403", async () => {
    const res = await request(app).get("/api/admin/users");

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "unauthorized");
  });
});
