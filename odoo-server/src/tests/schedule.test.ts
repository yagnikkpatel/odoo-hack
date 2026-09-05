import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import request from "supertest";
import { app, auth, shutdown, TEST_PREFIX, tokenFor } from "./helpers";

after(shutdown);

const hr = () => tokenFor("hr_manager");

function weekday(day: number, start = "09:00", end = "18:00", breakMinutes = 60) {
  return { day_of_week: day, start_time: start, end_time: end, break_minutes: breakMinutes };
}

function fullWeek() {
  return [0, 1, 2, 3, 4].map((day) => weekday(day));
}

describe("POST /api/working-schedules", () => {
  it("derives hours_per_week from the lines (BR-SCH-1)", async () => {
    const res = await request(app)
      .post("/api/working-schedules")
      .set(...auth(await hr()))
      .send({ name: `${TEST_PREFIX}Standard-${Date.now()}`, lines: fullWeek() });

    assert.equal(res.status, 201);
    // 5 days x (9h - 60min) = 40.00
    assert.equal(res.body.data.hours_per_week, "40.00");
    assert.equal(res.body.data.lines.length, 5);
    assert.equal(res.body.data.lines[0].hours, "8.00");
  });

  it("rejects a client-supplied hours_per_week rather than ignoring it (BR-X-5)", async () => {
    const res = await request(app)
      .post("/api/working-schedules")
      .set(...auth(await hr()))
      .send({
        name: `${TEST_PREFIX}Lying-${Date.now()}`,
        hours_per_week: "99.00",
        lines: fullWeek(),
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "read_only_field");
  });

  it("computes part-time hours correctly", async () => {
    const res = await request(app)
      .post("/api/working-schedules")
      .set(...auth(await hr()))
      .send({
        name: `${TEST_PREFIX}Half-${Date.now()}`,
        schedule_type: "part_time",
        lines: [weekday(0, "09:00", "13:00", 0), weekday(2, "09:00", "13:00", 0)],
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.hours_per_week, "8.00");
  });

  it("refuses overlapping lines on the same day (BR-SCH-3)", async () => {
    const res = await request(app)
      .post("/api/working-schedules")
      .set(...auth(await hr()))
      .send({
        name: `${TEST_PREFIX}Overlap-${Date.now()}`,
        lines: [weekday(0, "09:00", "13:00", 0), weekday(0, "12:00", "17:00", 0)],
      });

    assert.equal(res.status, 400);
    assert.equal(res.body.code, "schedule_line_overlap");
  });

  it("allows a split day that does not overlap", async () => {
    const res = await request(app)
      .post("/api/working-schedules")
      .set(...auth(await hr()))
      .send({
        name: `${TEST_PREFIX}Split-${Date.now()}`,
        lines: [
          { ...weekday(0, "09:00", "13:00", 0), day_period: "morning" },
          { ...weekday(0, "14:00", "18:00", 0), day_period: "afternoon" },
        ],
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.hours_per_week, "8.00");
  });

  it("refuses a break that consumes the whole span (BR-SCH-2)", async () => {
    const res = await request(app)
      .post("/api/working-schedules")
      .set(...auth(await hr()))
      .send({
        name: `${TEST_PREFIX}NoTime-${Date.now()}`,
        lines: [weekday(0, "09:00", "10:00", 60)],
      });

    assert.equal(res.status, 400);
  });

  it("refuses end_time before start_time and a malformed time", async () => {
    const token = await hr();

    const backwards = await request(app)
      .post("/api/working-schedules")
      .set(...auth(token))
      .send({ name: `${TEST_PREFIX}Back-${Date.now()}`, lines: [weekday(0, "18:00", "09:00", 0)] });

    assert.equal(backwards.status, 400);

    const malformed = await request(app)
      .post("/api/working-schedules")
      .set(...auth(token))
      .send({ name: `${TEST_PREFIX}Bad-${Date.now()}`, lines: [weekday(0, "9am", "5pm", 0)] });

    assert.equal(malformed.status, 400);
  });
});

describe("PATCH /api/working-schedules/:id", () => {
  it("replaces the pattern atomically and recomputes hours (BR-SCH-4)", async () => {
    const token = await hr();

    const created = await request(app)
      .post("/api/working-schedules")
      .set(...auth(token))
      .send({ name: `${TEST_PREFIX}Reduce-${Date.now()}`, lines: fullWeek() });

    assert.equal(created.body.data.hours_per_week, "40.00");

    const patched = await request(app)
      .patch(`/api/working-schedules/${created.body.data.id}`)
      .set(...auth(token))
      .send({ lines: [weekday(0), weekday(1), weekday(2)] });

    assert.equal(patched.status, 200);
    assert.equal(patched.body.data.hours_per_week, "24.00");
    assert.equal(patched.body.data.lines.length, 3);
  });

  it("leaves the pattern alone when lines are omitted", async () => {
    const token = await hr();

    const created = await request(app)
      .post("/api/working-schedules")
      .set(...auth(token))
      .send({ name: `${TEST_PREFIX}Rename-${Date.now()}`, lines: fullWeek() });

    const patched = await request(app)
      .patch(`/api/working-schedules/${created.body.data.id}`)
      .set(...auth(token))
      .send({ is_flexible: true });

    assert.equal(patched.body.data.hours_per_week, "40.00");
    assert.equal(patched.body.data.lines.length, 5);
    assert.equal(patched.body.data.is_flexible, true);
  });

  it("rolls back the whole replacement when one line is invalid", async () => {
    const token = await hr();

    const created = await request(app)
      .post("/api/working-schedules")
      .set(...auth(token))
      .send({ name: `${TEST_PREFIX}Atomic-${Date.now()}`, lines: fullWeek() });

    const failed = await request(app)
      .patch(`/api/working-schedules/${created.body.data.id}`)
      .set(...auth(token))
      .send({ lines: [weekday(0), weekday(0, "09:30", "17:00", 0)] });

    assert.equal(failed.status, 400);

    const unchanged = await request(app)
      .get(`/api/working-schedules/${created.body.data.id}`)
      .set(...auth(token));

    assert.equal(unchanged.body.data.lines.length, 5, "the original pattern must survive");
    assert.equal(unchanged.body.data.hours_per_week, "40.00");
  });
});

describe("Working schedule listing and archival", () => {
  it("paginates and filters by type", async () => {
    const res = await request(app)
      .get("/api/working-schedules?schedule_type=full_time&limit=5")
      .set(...auth(await hr()));

    assert.equal(res.status, 200);
    assert.ok(res.body.meta.total >= 0);
    assert.ok(res.body.data.every((s: { schedule_type: string }) => s.schedule_type === "full_time"));
  });

  it("archives an unused schedule", async () => {
    const token = await hr();

    const created = await request(app)
      .post("/api/working-schedules")
      .set(...auth(token))
      .send({ name: `${TEST_PREFIX}Unused-${Date.now()}`, lines: fullWeek() });

    const archived = await request(app)
      .delete(`/api/working-schedules/${created.body.data.id}`)
      .set(...auth(token));

    assert.equal(archived.status, 200);

    const still = await request(app)
      .get(`/api/working-schedules/${created.body.data.id}`)
      .set(...auth(token));

    assert.equal(still.body.data.active, false, "archived, not deleted");
  });

  it("404s an unknown schedule", async () => {
    const res = await request(app)
      .get("/api/working-schedules/00000000-0000-4000-8000-000000000000")
      .set(...auth(await hr()));

    assert.equal(res.status, 404);
  });

  it("an Employee cannot read schedules", async () => {
    const res = await request(app)
      .get("/api/working-schedules")
      .set(...auth(await tokenFor("employee")));

    assert.equal(res.status, 403);
  });
});
