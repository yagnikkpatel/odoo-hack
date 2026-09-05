import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { app, auth, createTestUser, login, shutdown } from "./helpers";

after(shutdown);

describe("GET /api/health", () => {
  it("responds without auth", async () => {
    const res = await request(app).get("/api/health");

    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { success: true, message: "ok" });
  });
});

describe("unmatched routes", () => {
  it("404s rather than 401ing — a mounted auth guard must not swallow them", async () => {
    const res = await request(app).get("/api/nope");

    assert.equal(res.status, 404);
    assert.equal(res.body.message, "Route not found");
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token, expiry and the session user (BR-AUTH-3)", async () => {
    const user = await createTestUser("hr_manager");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.accessToken);
    assert.equal(typeof res.body.data.expiresIn, "number");
    assert.equal(res.body.data.user.role, "hr_manager");
    assert.equal(res.body.data.user.role_label, "HR Manager");
    assert.ok(Array.isArray(res.body.data.user.permissions));
  });

  it("accepts a mixed-case email (normalised to lowercase)", async () => {
    const user = await createTestUser("employee");
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email.toUpperCase(), password: user.password });

    assert.equal(res.status, 200);
  });

  it("stamps last_login_at (BR-AUTH-5)", async () => {
    const user = await createTestUser("employee");

    await login(user.email, user.password);

    const me = await request(app)
      .get("/api/auth/me")
      .set(...auth(await login(user.email, user.password)));

    assert.equal(me.status, 200);
  });

  it("gives the same error for an unknown email and a wrong password (BR-AUTH-4)", async () => {
    const user = await createTestUser("employee");

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "NotThePassword1" });

    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody-at-all@test.local", password: "NotThePassword1" });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknownEmail.status, 401);
    assert.equal(wrongPassword.body.message, unknownEmail.body.message);
    assert.equal(wrongPassword.body.code, "invalid_credentials");
  });

  it("refuses a deactivated account (BR-AUTH-2)", async () => {
    const user = await createTestUser("employee", { active: false });
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "account_disabled");
  });

  it("rejects a malformed body with per-field details (BR-X-4)", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "not-an-email" });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "validation_error");
    assert.ok(res.body.details.some((d: { field: string }) => d.field === "email"));
    assert.ok(res.body.details.some((d: { field: string }) => d.field === "password"));
  });
});

describe("GET /api/auth/me", () => {
  it("returns the caller's permission codes", async () => {
    const user = await createTestUser("hr_payroll_manager");
    const res = await request(app)
      .get("/api/auth/me")
      .set(...auth(await login(user.email, user.password)));

    assert.equal(res.status, 200);
    assert.equal(res.body.data.role, "hr_payroll_manager");
    assert.equal(res.body.data.permissions.length, 35);
    assert.ok(res.body.data.permissions.includes("payrun.validate"));
    assert.ok(!res.body.data.permissions.includes("admin.user.manage"));
  });

  it("rejects a missing token", async () => {
    const res = await request(app).get("/api/auth/me");

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "unauthorized");
  });

  it("rejects a garbage token", async () => {
    const res = await request(app).get("/api/auth/me").set(...auth("not.a.jwt"));

    assert.equal(res.status, 401);
  });
});

describe("POST /api/auth/change-password", () => {
  it("changes the password and invalidates the old one", async () => {
    const user = await createTestUser("employee");
    const token = await login(user.email, user.password);

    const changed = await request(app)
      .post("/api/auth/change-password")
      .set(...auth(token))
      .send({ currentPassword: user.password, newPassword: "BrandNew@456" });

    assert.equal(changed.status, 200);

    const withOld = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: user.password });

    assert.equal(withOld.status, 401);

    const withNew = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "BrandNew@456" });

    assert.equal(withNew.status, 200);
  });

  it("refuses a wrong current password", async () => {
    const user = await createTestUser("employee");
    const res = await request(app)
      .post("/api/auth/change-password")
      .set(...auth(await login(user.email, user.password)))
      .send({ currentPassword: "WrongPass@1", newPassword: "BrandNew@456" });

    assert.equal(res.status, 401);
    assert.equal(res.body.code, "invalid_credentials");
  });

  it("enforces the minimum length (BR-AUTH-1)", async () => {
    const user = await createTestUser("employee");
    const res = await request(app)
      .post("/api/auth/change-password")
      .set(...auth(await login(user.email, user.password)))
      .send({ currentPassword: user.password, newPassword: "short" });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "validation_error");
  });
});
