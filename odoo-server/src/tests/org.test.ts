import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import {
  app,
  auth,
  createTestDepartment,
  createTestEmployee,
  login,
  shutdown,
  TEST_PREFIX,
  tokenFor,
} from "./helpers";

after(shutdown);

const hrToken = () => tokenFor("hr_manager");

describe("Departments", () => {
  it("creates, lists and updates", async () => {
    const token = await hrToken();
    const name = `${TEST_PREFIX}Engineering-${Date.now()}`;

    const created = await request(app)
      .post("/api/departments")
      .set(...auth(token))
      .send({ name });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.name, name);
    assert.equal(created.body.data.employee_count, 0);
    assert.equal(created.body.data.active, true);
    assert.equal(created.body.data.manager, null);

    const listed = await request(app)
      .get(`/api/departments?q=${encodeURIComponent(name)}`)
      .set(...auth(token));

    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.length, 1);

    const patched = await request(app)
      .patch(`/api/departments/${created.body.data.id}`)
      .set(...auth(token))
      .send({ name: `${name}-renamed` });

    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.name, `${name}-renamed`);
  });

  it("reports employee_count and refuses to archive while staffed (BR-EMP-7)", async () => {
    const token = await hrToken();
    const department = await createTestDepartment();

    await createTestEmployee({ department_id: department.id });

    const listed = await request(app)
      .get(`/api/departments?q=${encodeURIComponent(department.name)}`)
      .set(...auth(token));

    assert.equal(listed.body.data[0].employee_count, 1);

    const archived = await request(app)
      .delete(`/api/departments/${department.id}`)
      .set(...auth(token));

    assert.equal(archived.status, 409);
    assert.equal(archived.body.code, "in_use");
  });

  it("archives an empty department rather than deleting it", async () => {
    const token = await hrToken();
    const department = await createTestDepartment();

    const archived = await request(app)
      .delete(`/api/departments/${department.id}`)
      .set(...auth(token));

    assert.equal(archived.status, 200);

    const listed = await request(app)
      .get(`/api/departments?active=false&q=${encodeURIComponent(department.name)}`)
      .set(...auth(token));

    assert.equal(listed.body.data.length, 1, "the row must survive, archived");
    assert.equal(listed.body.data[0].active, false);
  });

  it("refuses a duplicate name and a self-parent", async () => {
    const token = await hrToken();
    const department = await createTestDepartment();

    const duplicate = await request(app)
      .post("/api/departments")
      .set(...auth(token))
      .send({ name: department.name });

    assert.equal(duplicate.status, 409);

    const selfParent = await request(app)
      .patch(`/api/departments/${department.id}`)
      .set(...auth(token))
      .send({ parent_id: department.id });

    assert.equal(selfParent.status, 400);
  });

  it("rejects an unknown parent", async () => {
    const res = await request(app)
      .post("/api/departments")
      .set(...auth(await hrToken()))
      .send({
        name: `${TEST_PREFIX}orphan-${Date.now()}`,
        parent_id: "00000000-0000-4000-8000-000000000000",
      });

    assert.equal(res.status, 400);
  });
});

describe("Job positions", () => {
  it("creates with a department and reports it", async () => {
    const token = await hrToken();
    const department = await createTestDepartment();

    const created = await request(app)
      .post("/api/job-positions")
      .set(...auth(token))
      .send({ name: `${TEST_PREFIX}Engineer-${Date.now()}`, department_id: department.id });

    assert.equal(created.status, 201);
    assert.equal(created.body.data.department_name, department.name);
  });

  it("refuses to archive while employees hold it (BR-EMP-7)", async () => {
    const token = await hrToken();

    const created = await request(app)
      .post("/api/job-positions")
      .set(...auth(token))
      .send({ name: `${TEST_PREFIX}Held-${Date.now()}` });

    await createTestEmployee({ job_position_id: created.body.data.id });

    const archived = await request(app)
      .delete(`/api/job-positions/${created.body.data.id}`)
      .set(...auth(token));

    assert.equal(archived.status, 409);
    assert.equal(archived.body.code, "in_use");
  });
});

describe("Employment types", () => {
  it("lists the four seeded types", async () => {
    const res = await request(app)
      .get("/api/employment-types?active=true")
      .set(...auth(await hrToken()));

    assert.equal(res.status, 200);

    const codes = res.body.data.map((t: { code: string }) => t.code);

    for (const code of ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]) {
      assert.ok(codes.includes(code), `missing seeded type ${code}`);
    }
  });

  it("needs config.write to create — HR Manager cannot", async () => {
    const res = await request(app)
      .post("/api/employment-types")
      .set(...auth(await hrToken()))
      .send({ name: "Seasonal", code: "SEASONAL" });

    assert.equal(res.status, 403);
  });

  it("lets a Payroll Manager create one, and validates the code format", async () => {
    const token = await tokenFor("hr_payroll_manager");

    const bad = await request(app)
      .post("/api/employment-types")
      .set(...auth(token))
      .send({ name: "Bad", code: "lower case" });

    assert.equal(bad.status, 400);
  });
});

describe("Organisation authorization", () => {
  it("an Employee cannot read or write org config", async () => {
    const user = await tokenFor("employee");

    for (const path of ["/api/departments", "/api/job-positions", "/api/employment-types"]) {
      const res = await request(app).get(path).set(...auth(user));

      assert.equal(res.status, 403, `${path} should be 403 for an employee`);
    }
  });

  it("unmatched paths still 404 — the org router carries per-route guards", async () => {
    const res = await request(app).get("/api/departments-typo");

    assert.equal(res.status, 404);
  });
});
