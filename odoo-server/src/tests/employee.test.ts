import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { pool } from "../lib/db";
import {
  app,
  auth,
  createTestDepartment,
  createTestEmployee,
  createTestUser,
  login,
  roleId,
  shutdown,
  TEST_PREFIX,
  tokenFor,
} from "./helpers";

after(shutdown);

const hrToken = () => tokenFor("hr_manager");

function newEmployee(overrides: Record<string, unknown> = {}) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    first_name: "Aarav",
    last_name: "Mehta",
    work_email: `${TEST_PREFIX}${suffix}@test.local`,
    ...overrides,
  };
}

describe("POST /api/employees", () => {
  it("allocates a sequential employee_number (BR-EMP-1, BR-X-9)", async () => {
    const token = await hrToken();

    const first = await request(app)
      .post("/api/employees")
      .set(...auth(token))
      .send(newEmployee());
    const second = await request(app)
      .post("/api/employees")
      .set(...auth(token))
      .send(newEmployee());

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.match(first.body.data.employee_number, /^EMP-\d{4,}$/);

    const a = Number(first.body.data.employee_number.slice(4));
    const b = Number(second.body.data.employee_number.slice(4));

    assert.equal(b, a + 1, "numbers must be sequential");

    // Clean up: these carry generated EMP- numbers, not the test prefix.
    await pool.query("DELETE FROM employees WHERE id = ANY($1::uuid[])", [
      [first.body.data.id, second.body.data.id],
    ]);
  });

  it("never allocates the same number twice under concurrency (BR-X-9)", async () => {
    const token = await hrToken();

    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        request(app).post("/api/employees").set(...auth(token)).send(newEmployee()),
      ),
    );

    const created = responses.filter((r) => r.status === 201);
    const numbers = created.map((r) => r.body.data.employee_number);

    assert.equal(created.length, 8, "all creates should succeed");
    assert.equal(new Set(numbers).size, 8, `duplicate numbers issued: ${numbers.join(", ")}`);

    await pool.query("DELETE FROM employees WHERE id = ANY($1::uuid[])", [
      created.map((r) => r.body.data.id),
    ]);
  });

  it("refuses a duplicate work email (BR-EMP-2)", async () => {
    const token = await hrToken();
    const body = newEmployee();

    const first = await request(app).post("/api/employees").set(...auth(token)).send(body);
    const second = await request(app).post("/api/employees").set(...auth(token)).send(body);

    assert.equal(first.status, 201);
    assert.equal(second.status, 409);
    assert.equal(second.body.code, "duplicate_work_email");

    await pool.query("DELETE FROM employees WHERE id = $1", [first.body.data.id]);
  });

  it("validates required names and enum values", async () => {
    const token = await hrToken();

    const noName = await request(app)
      .post("/api/employees")
      .set(...auth(token))
      .send({ last_name: "Mehta" });

    assert.equal(noName.status, 400);
    assert.ok(noName.body.details.some((d: { field: string }) => d.field === "first_name"));

    const badGender = await request(app)
      .post("/api/employees")
      .set(...auth(token))
      .send(newEmployee({ gender: "unknown" }));

    assert.equal(badGender.status, 400);
  });

  it("rejects an unknown department or job position", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set(...auth(await hrToken()))
      .send(newEmployee({ department_id: "00000000-0000-4000-8000-000000000000" }));

    assert.equal(res.status, 400);
    assert.ok(res.body.details.some((d: { field: string }) => d.field === "department_id"));
  });
});

describe("GET /api/employees", () => {
  it("paginates and filters by department", async () => {
    const token = await hrToken();
    const department = await createTestDepartment();

    await createTestEmployee({ department_id: department.id });
    await createTestEmployee();

    const res = await request(app)
      .get(`/api/employees?department_id=${department.id}`)
      .set(...auth(token));

    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assert.equal(res.body.data[0].department.name, department.name);
    assert.ok(res.body.meta.total >= 1);
  });

  it("filters by employment status and searches by name", async () => {
    const token = await hrToken();

    await createTestEmployee({ first_name: "Zephyrine", employment_status: "suspended" });

    const byStatus = await request(app)
      .get("/api/employees?employment_status=suspended&q=Zephyrine")
      .set(...auth(token));

    assert.equal(byStatus.status, 200);
    assert.equal(byStatus.body.data.length, 1);
    assert.equal(byStatus.body.data[0].employment_status, "suspended");
  });

  it("rejects an unsortable column", async () => {
    const res = await request(app)
      .get("/api/employees?sort=bank_account_number")
      .set(...auth(await hrToken()));

    assert.equal(res.status, 400);
  });
});

describe("Self-scoping (BR-RBAC-2)", () => {
  it("an Employee sees only their own record, whatever they filter by", async () => {
    const account = await createTestUser("employee");
    const mine = await createTestEmployee({ user_id: account.id, first_name: "Mine" });

    await createTestEmployee({ first_name: "Someone" });

    const token = await login(account.email, account.password);

    const listed = await request(app).get("/api/employees").set(...auth(token));

    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].id, mine.id);

    // Even asking for everyone by department returns just their own row.
    const filtered = await request(app)
      .get("/api/employees?department_id=")
      .set(...auth(token));

    assert.equal(filtered.body.data.length, 1);
  });

  it("an Employee gets 404 for someone else's record, not 403 (BR-RBAC-8)", async () => {
    const account = await createTestUser("employee");

    await createTestEmployee({ user_id: account.id });

    const other = await createTestEmployee();
    const token = await login(account.email, account.password);

    const res = await request(app).get(`/api/employees/${other.id}`).set(...auth(token));

    assert.equal(res.status, 404);
    assert.equal(res.body.code, "not_found");
  });

  it("an account with no employee record cannot use the self-scoped list", async () => {
    const account = await createTestUser("employee");
    const res = await request(app)
      .get("/api/employees")
      .set(...auth(await login(account.email, account.password)));

    assert.equal(res.status, 403);
    assert.equal(res.body.code, "no_employee_record");
  });

  it("puts employeeId in the session so the client can resolve 'me'", async () => {
    const account = await createTestUser("employee");
    const employee = await createTestEmployee({ user_id: account.id });

    const res = await request(app)
      .get("/api/auth/me")
      .set(...auth(await login(account.email, account.password)));

    assert.equal(res.body.data.employee.id, employee.id);
    assert.equal(res.body.data.employee.employee_number, employee.employee_number);
  });
});

describe("Bank detail masking (BR-RBAC-7)", () => {
  it("masks for HR Manager and reveals for a payroll role", async () => {
    const employee = await createTestEmployee({
      bank_name: "HDFC",
      bank_account_number: "50100123456789",
      bank_ifsc: "HDFC0001234",
    });

    const masked = await request(app)
      .get(`/api/employees/${employee.id}`)
      .set(...auth(await hrToken()));

    assert.equal(masked.status, 200);
    assert.equal(masked.body.data.bank_account_number, "••••6789");

    const full = await request(app)
      .get(`/api/employees/${employee.id}`)
      .set(...auth(await tokenFor("hr_payroll_user")));

    assert.equal(full.body.data.bank_account_number, "50100123456789");
  });
});

describe("Manager cycles (BR-EMP-3)", () => {
  it("refuses self-management", async () => {
    const employee = await createTestEmployee();
    const res = await request(app)
      .patch(`/api/employees/${employee.id}`)
      .set(...auth(await hrToken()))
      .send({ manager_id: employee.id });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "manager_cycle");
  });

  it("refuses a loop further up the chain", async () => {
    const token = await hrToken();
    const top = await createTestEmployee();
    const middle = await createTestEmployee({ manager_id: top.id });
    const bottom = await createTestEmployee({ manager_id: middle.id });

    // Making `bottom` manage `top` would close the loop top -> middle -> bottom -> top.
    const res = await request(app)
      .patch(`/api/employees/${top.id}`)
      .set(...auth(token))
      .send({ manager_id: bottom.id });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "manager_cycle");
  });

  it("allows a legitimate manager assignment", async () => {
    const token = await hrToken();
    const manager = await createTestEmployee();
    const report = await createTestEmployee();

    const res = await request(app)
      .patch(`/api/employees/${report.id}`)
      .set(...auth(token))
      .send({ manager_id: manager.id });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.manager.id, manager.id);
  });
});

describe("DELETE /api/employees/:id — terminate (BR-EMP-4, BR-EMP-5)", () => {
  it("terminates rather than deleting", async () => {
    const employee = await createTestEmployee({ hire_date: "2024-01-01" });

    const res = await request(app)
      .delete(`/api/employees/${employee.id}`)
      .set(...auth(await tokenFor("hr_manager")))
      .send({ termination_date: "2026-03-31", reason: "Resignation" });

    assert.equal(res.status, 200);

    const row = await pool.query(
      "SELECT employment_status, termination_date FROM employees WHERE id = $1",
      [employee.id],
    );

    assert.equal(row.rowCount, 1, "the row must survive");
    assert.equal(row.rows[0].employment_status, "terminated");
  });

  it("refuses a termination date before the hire date (BR-EMP-5)", async () => {
    const employee = await createTestEmployee({ hire_date: "2025-06-01" });

    const res = await request(app)
      .delete(`/api/employees/${employee.id}`)
      .set(...auth(await hrToken()))
      .send({ termination_date: "2024-01-01" });

    assert.equal(res.status, 400);
  });
});

describe("GET /api/employees/:id/summary (BR-EMP-8)", () => {
  it("reports honest completeness flags", async () => {
    const incomplete = await createTestEmployee();

    const res = await request(app)
      .get(`/api/employees/${incomplete.id}/summary`)
      .set(...auth(await hrToken()));

    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.data_completeness, {
      has_bank_details: false,
      has_working_schedule: false,
      has_running_contract: false,
      has_work_email: false,
    });
    assert.equal(res.body.data.employee.id, incomplete.id);
    assert.equal(typeof res.body.data.counts.contracts, "number");
  });

  it("flips the flags once the data is there", async () => {
    const complete = await createTestEmployee({
      work_email: `${TEST_PREFIX}complete-${Date.now()}@test.local`,
      bank_name: "HDFC",
      bank_account_number: "50100999",
      bank_ifsc: "HDFC0001234",
    });

    const res = await request(app)
      .get(`/api/employees/${complete.id}/summary`)
      .set(...auth(await hrToken()));

    assert.equal(res.body.data.data_completeness.has_bank_details, true);
    assert.equal(res.body.data.data_completeness.has_work_email, true);
  });
});

describe("Linking an employee to a login (BR-EMP-6)", () => {
  it("links on user creation and refuses a second account", async () => {
    const admin = await tokenFor("admin");
    const employee = await createTestEmployee();

    const first = await request(app)
      .post("/api/admin/users")
      .set(...auth(admin))
      .send({
        email: `${TEST_PREFIX}link1-${Date.now()}@test.local`,
        password: "Linked@1234",
        role_id: await roleId("employee"),
        employee_id: employee.id,
      });

    assert.equal(first.status, 201);
    assert.equal(first.body.data.employee.id, employee.id);

    const second = await request(app)
      .post("/api/admin/users")
      .set(...auth(admin))
      .send({
        email: `${TEST_PREFIX}link2-${Date.now()}@test.local`,
        password: "Linked@1234",
        role_id: await roleId("employee"),
        employee_id: employee.id,
      });

    assert.equal(second.status, 409);
    assert.equal(second.body.code, "employee_already_linked");
  });
});
