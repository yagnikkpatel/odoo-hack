import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { app, auth, createTestUser, login, roleId, shutdown, TEST_PREFIX, tokenFor } from "./helpers";
import { pool } from "../lib/db";

after(shutdown);

async function adminToken(): Promise<string> {
  return tokenFor("admin");
}

describe("GET /api/admin/users", () => {
  it("paginates with the documented meta shape (BR-X-2)", async () => {
    const res = await request(app)
      .get("/api/admin/users?limit=2&page=1")
      .set(...auth(await adminToken()));

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.length <= 2);
    assert.deepEqual(Object.keys(res.body.meta).sort(), [
      "limit",
      "page",
      "total",
      "total_pages",
    ]);
  });

  it("filters by role and active flag", async () => {
    const token = await adminToken();
    await createTestUser("employee", { active: false });

    const res = await request(app)
      .get(`/api/admin/users?role_id=${await roleId("employee")}&is_active=false`)
      .set(...auth(token));

    assert.equal(res.status, 200);
    assert.ok(res.body.data.every((u: { is_active: boolean }) => u.is_active === false));
  });

  it("rejects an unsortable column rather than interpolating it", async () => {
    const res = await request(app)
      .get("/api/admin/users?sort=password_hash")
      .set(...auth(await adminToken()));

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "validation_error");
  });

  it("rejects a non-positive limit", async () => {
    const res = await request(app)
      .get("/api/admin/users?limit=0")
      .set(...auth(await adminToken()));

    assert.equal(res.status, 400);
  });
});

describe("POST /api/admin/users", () => {
  it("creates a user with a role", async () => {
    const email = `${TEST_PREFIX}created-${Date.now()}@test.local`;
    const res = await request(app)
      .post("/api/admin/users")
      .set(...auth(await adminToken()))
      .send({ email, password: "Created@1234", role_id: await roleId("hr_manager") });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.email, email);
    assert.equal(res.body.data.role_name, "hr_manager");
    assert.equal(res.body.data.is_active, true);
    assert.ok(!("password_hash" in res.body.data), "must never leak the hash");
  });

  it("refuses a duplicate email", async () => {
    const token = await adminToken();
    const existing = await createTestUser("employee");

    const res = await request(app)
      .post("/api/admin/users")
      .set(...auth(token))
      .send({ email: existing.email, password: "Created@1234", role_id: await roleId("employee") });

    assert.equal(res.status, 409);
    assert.equal(res.body.code, "duplicate_email");
  });

  it("refuses an unknown role", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set(...auth(await adminToken()))
      .send({
        email: `${TEST_PREFIX}norole-${Date.now()}@test.local`,
        password: "Created@1234",
        role_id: "00000000-0000-4000-8000-000000000000",
      });

    assert.equal(res.status, 400);
  });

  it("enforces the minimum password length (BR-AUTH-1)", async () => {
    const res = await request(app)
      .post("/api/admin/users")
      .set(...auth(await adminToken()))
      .send({
        email: `${TEST_PREFIX}short-${Date.now()}@test.local`,
        password: "abc",
        role_id: await roleId("employee"),
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "validation_error");
  });
});

describe("PATCH & DELETE /api/admin/users/:id", () => {
  it("changes a role and deactivates", async () => {
    const token = await adminToken();
    const user = await createTestUser("employee");

    const patched = await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set(...auth(token))
      .send({ role_id: await roleId("hr_manager"), is_active: false });

    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.role_name, "hr_manager");
    assert.equal(patched.body.data.is_active, false);
  });

  it("deactivates rather than deleting (BR-RBAC-6)", async () => {
    const token = await adminToken();
    const user = await createTestUser("employee");

    const res = await request(app)
      .delete(`/api/admin/users/${user.id}`)
      .set(...auth(token));

    assert.equal(res.status, 200);

    const still = await pool.query("SELECT is_active FROM users WHERE id = $1", [user.id]);
    assert.equal(still.rowCount, 1, "the row must survive");
    assert.equal(still.rows[0].is_active, false);
  });

  it("404s an unknown id, and a malformed one", async () => {
    const token = await adminToken();

    const unknown = await request(app)
      .get("/api/admin/users/00000000-0000-4000-8000-000000000000")
      .set(...auth(token));

    const malformed = await request(app)
      .get("/api/admin/users/not-a-uuid")
      .set(...auth(token));

    assert.equal(unknown.status, 404);
    assert.equal(malformed.status, 404, "must not surface a Postgres cast error as a 500");
  });

  it("refuses an empty patch body", async () => {
    const token = await adminToken();
    const user = await createTestUser("employee");

    const res = await request(app)
      .patch(`/api/admin/users/${user.id}`)
      .set(...auth(token))
      .send({});

    assert.equal(res.status, 400);
  });
});

describe("Role permission matrix", () => {
  it("lists roles with their counts", async () => {
    const res = await request(app).get("/api/admin/roles").set(...auth(await adminToken()));

    assert.equal(res.status, 200);

    const counts = Object.fromEntries(
      res.body.data.map((r: { name: string; permission_count: number }) => [
        r.name,
        r.permission_count,
      ]),
    );

    // The matrix documented in api-contract.md.
    assert.deepEqual(counts, {
      employee: 6,
      hr_manager: 22,
      hr_payroll_user: 29,
      hr_payroll_manager: 35,
      admin: 37,
    });
  });

  it("exposes all 37 permission codes", async () => {
    const res = await request(app)
      .get("/api/admin/permissions")
      .set(...auth(await adminToken()));

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 37);
  });

  it("filters permissions by module", async () => {
    const res = await request(app)
      .get("/api/admin/permissions?module=payroll")
      .set(...auth(await adminToken()));

    assert.equal(res.status, 200);
    assert.ok(res.body.data.every((p: { module: string }) => p.module === "payroll"));
  });

  it("rejects an unknown module", async () => {
    const res = await request(app)
      .get("/api/admin/permissions?module=nonsense")
      .set(...auth(await adminToken()));

    assert.equal(res.status, 400);
  });

  it("replaces a role's grants and the change takes effect (BR-RBAC-3)", async () => {
    const token = await adminToken();
    const employeeRole = await roleId("employee");

    const original = await request(app)
      .get(`/api/admin/roles/${employeeRole}/permissions`)
      .set(...auth(token));

    const originalCodes = original.body.data.map((p: { code: string }) => p.code);

    try {
      const replaced = await request(app)
        .put(`/api/admin/roles/${employeeRole}/permissions`)
        .set(...auth(token))
        .send({ permission_codes: ["employee.read_self"] });

      assert.equal(replaced.status, 200);
      assert.equal(replaced.body.data.length, 1);

      // A freshly issued session must reflect the new matrix, not a cached one.
      const employee = await createTestUser("employee");
      const me = await request(app)
        .get("/api/auth/me")
        .set(...auth(await login(employee.email, employee.password)));

      assert.deepEqual(me.body.data.permissions, ["employee.read_self"]);
    } finally {
      await request(app)
        .put(`/api/admin/roles/${employeeRole}/permissions`)
        .set(...auth(token))
        .send({ permission_codes: originalCodes });
    }
  });

  it("refuses an unknown permission code", async () => {
    const res = await request(app)
      .put(`/api/admin/roles/${await roleId("employee")}/permissions`)
      .set(...auth(await adminToken()))
      .send({ permission_codes: ["employee.read_self", "not.a.permission"] });

    assert.equal(res.status, 400);
    assert.ok(
      res.body.details.some((d: { message: string }) => d.message.includes("not.a.permission")),
    );
  });

  it("stops an Admin removing admin.role.manage from their own role (BR-RBAC-6)", async () => {
    const res = await request(app)
      .put(`/api/admin/roles/${await roleId("admin")}/permissions`)
      .set(...auth(await adminToken()))
      .send({ permission_codes: ["employee.read"] });

    assert.equal(res.status, 422);
    assert.equal(res.body.code, "last_admin_protected");
  });
});
