import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { pool } from "../lib/db";
import {
  app,
  auth,
  createTestEmployee,
  createTestSchedule,
  createTestStructure,
  employmentTypeId,
  shutdown,
  tokenFor,
} from "./helpers";

after(shutdown);

const hr = () => tokenFor("hr_manager");

async function contractBody(overrides: Record<string, unknown> = {}) {
  const employee = await createTestEmployee();
  const schedule = await createTestSchedule();
  const structure = await createTestStructure();

  return {
    employee_id: employee.id,
    start_date: "2026-01-01",
    end_date: null,
    employment_type_id: await employmentTypeId(),
    working_schedule_id: schedule.id,
    salary_structure_id: structure.id,
    wage: "85000.00",
    wage_type: "monthly",
    ...overrides,
  };
}

/** Second contract for the same employee, reusing their schedule and structure. */
async function siblingBody(base: Record<string, unknown>, overrides: Record<string, unknown>) {
  return { ...base, ...overrides };
}

describe("POST /api/contracts", () => {
  it("creates a draft with a generated reference (BR-X-9)", async () => {
    const res = await request(app)
      .post("/api/contracts")
      .set(...auth(await hr()))
      .send(await contractBody());

    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, "draft");
    assert.match(res.body.data.reference, /^CON\/\d{4}\/\d{4,}$/);
    assert.equal(res.body.data.wage, "85000.00");
    assert.equal(res.body.data.is_active_now, false, "a draft is never in force");
    assert.equal(res.body.data.currency_code, "INR");
  });

  it("keeps wage as a decimal string, never a float (BR-X-3)", async () => {
    const res = await request(app)
      .post("/api/contracts")
      .set(...auth(await hr()))
      .send(await contractBody({ wage: 85000.555 }));

    assert.equal(res.status, 201);
    assert.equal(typeof res.body.data.wage, "string");
    assert.equal(res.body.data.wage, "85000.56", "rounds half-up to two places");
  });

  it("refuses an end date before the start date (BR-CON-2)", async () => {
    const res = await request(app)
      .post("/api/contracts")
      .set(...auth(await hr()))
      .send(await contractBody({ start_date: "2026-06-01", end_date: "2026-01-01" }));

    assert.equal(res.status, 400);
  });

  it("refuses a negative wage and an unknown employee (BR-CON-4)", async () => {
    const token = await hr();

    const unknownEmployee = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await contractBody({ employee_id: "00000000-0000-4000-8000-000000000000" }));

    assert.equal(unknownEmployee.status, 400);

    const negative = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await contractBody({ wage: "-100.00" }));

    assert.equal(negative.status, 400);
  });

  it("requires a working schedule and a salary structure (BR-CON-4)", async () => {
    const body = await contractBody();

    delete (body as Record<string, unknown>).working_schedule_id;

    const res = await request(app).post("/api/contracts").set(...auth(await hr())).send(body);

    assert.equal(res.status, 400);
    assert.ok(
      res.body.details.some((d: { field: string }) => d.field === "working_schedule_id"),
    );
  });
});

describe("Contract overlap (BR-CON-1)", () => {
  it("allows overlapping drafts — the rule only covers what has been in force", async () => {
    const token = await hr();
    const base = await contractBody();

    const first = await request(app).post("/api/contracts").set(...auth(token)).send(base);
    const second = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await siblingBody(base, { start_date: "2026-03-01" }));

    assert.equal(first.status, 201);
    assert.equal(second.status, 201, "two drafts may overlap freely");
  });

  it("refuses activating a second overlapping contract, naming the conflict", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2026-01-01", end_date: "2026-12-31" });

    const first = await request(app).post("/api/contracts").set(...auth(token)).send(base);
    const second = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await siblingBody(base, { start_date: "2026-06-01", end_date: "2027-05-31" }));

    const activatedFirst = await request(app)
      .post(`/api/contracts/${first.body.data.id}/activate`)
      .set(...auth(token));

    assert.equal(activatedFirst.status, 200);
    assert.equal(activatedFirst.body.data.status, "running");

    const activatedSecond = await request(app)
      .post(`/api/contracts/${second.body.data.id}/activate`)
      .set(...auth(token));

    assert.equal(activatedSecond.status, 409);
    assert.equal(activatedSecond.body.code, "contract_overlap");
    assert.match(
      activatedSecond.body.details[0].message,
      /conflicts with CON\//,
      "the error must name the conflicting contract",
    );
  });

  it("allows a consecutive contract that starts the day after the last one ends", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2026-01-01", end_date: "2026-06-30" });

    const first = await request(app).post("/api/contracts").set(...auth(token)).send(base);
    await request(app).post(`/api/contracts/${first.body.data.id}/activate`).set(...auth(token));

    const second = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await siblingBody(base, { start_date: "2026-07-01", end_date: null }));

    const activated = await request(app)
      .post(`/api/contracts/${second.body.data.id}/activate`)
      .set(...auth(token));

    assert.equal(activated.status, 200, "back-to-back contracts must not be treated as overlapping");
  });

  it("two concurrent activations leave exactly one running", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2026-01-01", end_date: "2026-12-31" });

    const a = await request(app).post("/api/contracts").set(...auth(token)).send(base);
    const b = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await siblingBody(base, { start_date: "2026-02-01", end_date: "2026-11-30" }));

    const [first, second] = await Promise.all([
      request(app).post(`/api/contracts/${a.body.data.id}/activate`).set(...auth(token)),
      request(app).post(`/api/contracts/${b.body.data.id}/activate`).set(...auth(token)),
    ]);

    const succeeded = [first, second].filter((r) => r.status === 200);
    const rejected = [first, second].filter((r) => r.status === 409);

    assert.equal(succeeded.length, 1, "exactly one activation should win");
    assert.equal(rejected.length, 1, "the loser must be a 409, not a 500");
    assert.equal(rejected[0].body.code, "contract_overlap");

    const running = await pool.query(
      "SELECT COUNT(*)::int AS c FROM contracts WHERE employee_id = $1 AND status = 'running'",
      [base.employee_id],
    );

    assert.equal(running.rows[0].c, 1);
  });

  it("refuses widening a running contract into a neighbour's window", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2026-01-01", end_date: "2026-06-30" });

    const first = await request(app).post("/api/contracts").set(...auth(token)).send(base);
    await request(app).post(`/api/contracts/${first.body.data.id}/activate`).set(...auth(token));

    const second = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await siblingBody(base, { start_date: "2026-07-01", end_date: "2026-12-31" }));

    await request(app).post(`/api/contracts/${second.body.data.id}/activate`).set(...auth(token));

    const widened = await request(app)
      .patch(`/api/contracts/${first.body.data.id}`)
      .set(...auth(token))
      .send({ end_date: "2026-09-30" });

    assert.equal(widened.status, 409);
    assert.equal(widened.body.code, "contract_overlap");
  });
});

describe("Contract overlap is enforced by the database, not just the service", () => {
  it("rejects an overlapping UPDATE issued straight to Postgres (BR-CON-1 backstop)", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2026-01-01", end_date: "2026-12-31" });

    const first = await request(app).post("/api/contracts").set(...auth(token)).send(base);
    const second = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await siblingBody(base, { start_date: "2026-06-01", end_date: "2027-05-31" }));

    await request(app).post(`/api/contracts/${first.body.data.id}/activate`).set(...auth(token));

    // Bypass the service entirely — if the rule lived only in application code, this would
    // silently create two contracts in force at once.
    await assert.rejects(
      () =>
        pool.query("UPDATE contracts SET status = 'running' WHERE id = $1", [
          second.body.data.id,
        ]),
      (error: { code?: string; constraint?: string }) => {
        assert.equal(error.code, "23P01", "expected an exclusion_violation");
        assert.equal(error.constraint, "contracts_no_overlap");

        return true;
      },
    );
  });
});

describe("Contract lifecycle (BR-CON-3, BR-CON-7)", () => {
  it("refuses illegal transitions", async () => {
    const token = await hr();
    const created = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await contractBody());

    await request(app).post(`/api/contracts/${created.body.data.id}/activate`).set(...auth(token));

    const again = await request(app)
      .post(`/api/contracts/${created.body.data.id}/activate`)
      .set(...auth(token));

    assert.equal(again.status, 422);
    assert.equal(again.body.code, "invalid_state_transition");
  });

  it("cancels a running contract, and refuses to cancel twice", async () => {
    const token = await hr();
    const created = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await contractBody());

    await request(app).post(`/api/contracts/${created.body.data.id}/activate`).set(...auth(token));

    const cancelled = await request(app)
      .post(`/api/contracts/${created.body.data.id}/cancel`)
      .set(...auth(token));

    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.body.data.status, "cancelled");

    const twice = await request(app)
      .post(`/api/contracts/${created.body.data.id}/cancel`)
      .set(...auth(token));

    assert.equal(twice.status, 422);
  });

  it("deletes a draft but not a running contract (BR-CON-7)", async () => {
    const token = await hr();

    const draft = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await contractBody());

    const deleted = await request(app)
      .delete(`/api/contracts/${draft.body.data.id}`)
      .set(...auth(token));

    assert.equal(deleted.status, 200);

    const live = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await contractBody());

    await request(app).post(`/api/contracts/${live.body.data.id}/activate`).set(...auth(token));

    const refused = await request(app)
      .delete(`/api/contracts/${live.body.data.id}`)
      .set(...auth(token));

    assert.equal(refused.status, 422);
  });

  it("refuses editing a cancelled contract", async () => {
    const token = await hr();
    const created = await request(app)
      .post("/api/contracts")
      .set(...auth(token))
      .send(await contractBody());

    await request(app).post(`/api/contracts/${created.body.data.id}/cancel`).set(...auth(token));

    const edited = await request(app)
      .patch(`/api/contracts/${created.body.data.id}`)
      .set(...auth(token))
      .send({ wage: "90000.00" });

    assert.equal(edited.status, 422);
    assert.equal(edited.body.code, "record_locked");
  });
});

describe("GET /api/contracts/applicable (BR-CON-5)", () => {
  it("resolves the contract covering the period", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2026-01-01", end_date: "2026-12-31" });

    const created = await request(app).post("/api/contracts").set(...auth(token)).send(base);

    await request(app).post(`/api/contracts/${created.body.data.id}/activate`).set(...auth(token));

    const resolved = await request(app)
      .get(
        `/api/contracts/applicable?employee_id=${base.employee_id}` +
          "&period_start=2026-02-01&period_end=2026-02-28",
      )
      .set(...auth(token));

    assert.equal(resolved.status, 200);
    assert.equal(resolved.body.data.id, created.body.data.id);
  });

  it("404s when no running contract covers the period", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2026-01-01", end_date: "2026-03-31" });

    const created = await request(app).post("/api/contracts").set(...auth(token)).send(base);

    await request(app).post(`/api/contracts/${created.body.data.id}/activate`).set(...auth(token));

    const outside = await request(app)
      .get(
        `/api/contracts/applicable?employee_id=${base.employee_id}` +
          "&period_start=2026-06-01&period_end=2026-06-30",
      )
      .set(...auth(token));

    assert.equal(outside.status, 404);
    assert.equal(outside.body.code, "no_applicable_contract");
  });

  it("ignores a draft contract — only running counts", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2026-01-01", end_date: "2026-12-31" });

    await request(app).post("/api/contracts").set(...auth(token)).send(base);

    const res = await request(app)
      .get(
        `/api/contracts/applicable?employee_id=${base.employee_id}` +
          "&period_start=2026-02-01&period_end=2026-02-28",
      )
      .set(...auth(token));

    assert.equal(res.status, 404);
  });

  it("validates its required query parameters", async () => {
    const res = await request(app)
      .get("/api/contracts/applicable?employee_id=not-a-uuid")
      .set(...auth(await hr()));

    assert.equal(res.status, 400);
  });
});

describe("Terminating an employee expires their contract (BR-CON-8)", () => {
  it("expires rather than deletes", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2024-01-01", end_date: null });

    const created = await request(app).post("/api/contracts").set(...auth(token)).send(base);

    await request(app).post(`/api/contracts/${created.body.data.id}/activate`).set(...auth(token));

    const terminated = await request(app)
      .delete(`/api/employees/${base.employee_id}`)
      .set(...auth(token))
      .send({ termination_date: "2026-03-31" });

    assert.equal(terminated.status, 200);

    const contract = await request(app)
      .get(`/api/contracts/${created.body.data.id}`)
      .set(...auth(token));

    assert.equal(contract.status, 200, "the contract must survive");
    assert.equal(contract.body.data.status, "expired");
    assert.equal(contract.body.data.end_date, "2026-03-31");
  });
});

describe("Contract listing and authorization", () => {
  it("filters by employee and status, and flags the active one", async () => {
    const token = await hr();
    const base = await contractBody();

    const created = await request(app).post("/api/contracts").set(...auth(token)).send(base);

    await request(app).post(`/api/contracts/${created.body.data.id}/activate`).set(...auth(token));

    const listed = await request(app)
      .get(`/api/contracts?employee_id=${base.employee_id}&status=running`)
      .set(...auth(token));

    assert.equal(listed.status, 200);
    assert.equal(listed.body.data.length, 1);
    assert.equal(listed.body.data[0].is_active_now, true);
  });

  it("an Employee cannot read contracts", async () => {
    const res = await request(app)
      .get("/api/contracts")
      .set(...auth(await tokenFor("employee")));

    assert.equal(res.status, 403);
  });
});

describe("Employee summary reflects contracts", () => {
  it("counts contracts and reports the current one", async () => {
    const token = await hr();
    const base = await contractBody({ start_date: "2020-01-01", end_date: null });

    const created = await request(app).post("/api/contracts").set(...auth(token)).send(base);

    await request(app).post(`/api/contracts/${created.body.data.id}/activate`).set(...auth(token));

    const summary = await request(app)
      .get(`/api/employees/${base.employee_id}/summary`)
      .set(...auth(token));

    assert.equal(summary.status, 200);
    assert.equal(summary.body.data.counts.contracts, 1);
    assert.equal(summary.body.data.current_contract.id, created.body.data.id);
    assert.equal(summary.body.data.data_completeness.has_running_contract, true);
  });
});
