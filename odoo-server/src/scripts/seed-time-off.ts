import type { PoolClient } from "pg";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

const EMPLOYEE_POOL_SIZE = 15;
const PTO_ALLOCATION_DAYS = 20;
const COMP_OFF_ALLOCATION_HOURS = 8;

type UserRow = {
  id: string;
};

type TypeInput = {
  name: string;
  code: string;
  unit: "days" | "hours";
  requiresAllocation: boolean;
  approval: "manager" | "none";
  payroll: "paid" | "unpaid";
  description: string;
};

const TYPES: TypeInput[] = [
  {
    name: "Paid Time Off",
    code: "PTO",
    unit: "days",
    requiresAllocation: true,
    approval: "manager",
    payroll: "paid",
    description: "Standard annual leave. Balance comes from approved allocations.",
  },
  {
    name: "Sick Leave",
    code: "SICK",
    unit: "days",
    requiresAllocation: false,
    approval: "manager",
    payroll: "paid",
    description: "Unplanned medical leave. No allocation required.",
  },
  {
    name: "Comp Off",
    code: "COMP_OFF",
    unit: "hours",
    requiresAllocation: true,
    approval: "manager",
    payroll: "unpaid",
    description: "Compensatory time off earned for extra hours worked.",
  },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function decision(action: string, at: Date, actorId: string, reason?: string) {
  return { at: at.toISOString(), actorId, action, ...(reason ? { reason } : {}) };
}

async function fetchEmployeePool(
  client: PoolClient,
  limit: number,
): Promise<UserRow[]> {
  const result = await client.query<UserRow>(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name <> 'admin'
     ORDER BY u.created_at
     LIMIT $1`,
    [limit],
  );

  return result.rows;
}

async function fetchApprover(client: PoolClient): Promise<string> {
  const result = await client.query<UserRow>(
    `SELECT u.id
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.name IN ('hr_manager', 'admin')
     ORDER BY r.name = 'hr_manager' DESC, u.created_at
     LIMIT 1`,
  );

  if (!result.rows[0]) {
    throw new Error("no hr_manager or admin user found to act as approver");
  }

  return result.rows[0].id;
}

async function upsertTypes(
  client: PoolClient,
): Promise<Map<string, { id: string; requiresAllocation: boolean; unit: string }>> {
  const byCode = new Map<
    string,
    { id: string; requiresAllocation: boolean; unit: string }
  >();

  for (const type of TYPES) {
    await client.query(
      `INSERT INTO time_off_types (
         name, code, unit, requires_allocation, approval, payroll, active, description
       )
       VALUES ($1, $2, $3, $4, $5, $6, true, $7)
       ON CONFLICT (lower(code)) DO NOTHING`,
      [
        type.name,
        type.code,
        type.unit,
        type.requiresAllocation,
        type.approval,
        type.payroll,
        type.description,
      ],
    );

    const result = await client.query<{
      id: string;
      requiresAllocation: boolean;
      unit: string;
    }>(
      `SELECT id, requires_allocation AS "requiresAllocation", unit
       FROM time_off_types WHERE lower(code) = lower($1)`,
      [type.code],
    );

    byCode.set(type.code, result.rows[0]);
  }

  return byCode;
}

async function insertAllocation(
  client: PoolClient,
  params: {
    employeeId: string;
    typeId: string;
    amount: number;
    validFrom: string;
    validTo: string;
    approverId: string;
  },
): Promise<string> {
  const submittedAt = addDays(new Date(), -randomInt(60, 200));
  const approvedAt = addDays(submittedAt, randomInt(1, 3));

  const result = await client.query<{ id: string }>(
    `INSERT INTO time_off_allocations (
       employee_id, type_id, amount, valid_from, valid_to, note, status, history
     )
     VALUES ($1, $2, $3, $4, $5, '', 'approved', $6::jsonb)
     RETURNING id`,
    [
      params.employeeId,
      params.typeId,
      params.amount,
      params.validFrom,
      params.validTo,
      JSON.stringify([
        decision("Submitted", submittedAt, params.employeeId),
        decision("Approved", approvedAt, params.approverId),
      ]),
    ],
  );

  return result.rows[0].id;
}

type SeedRequestParams = {
  employeeId: string;
  typeId: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  reason: string;
  unit: "days" | "hours";
  duration: number;
  charges: { date: string; amount: number }[];
  consumptions: { allocationId: string; date: string; amount: number }[];
  status: "pending" | "approved" | "refused" | "cancelled";
  approverId: string;
};

async function insertRequest(
  client: PoolClient,
  params: SeedRequestParams,
): Promise<void> {
  const submittedAt = addDays(new Date(), -randomInt(5, 45));
  const decidedAt = addDays(submittedAt, randomInt(1, 3));

  const history = [decision("Submitted", submittedAt, params.employeeId)];

  if (params.status === "approved") {
    history.push(decision("Approved", decidedAt, params.approverId));
  } else if (params.status === "refused") {
    history.push(
      decision("Refused", decidedAt, params.approverId, "Team coverage unavailable"),
    );
  } else if (params.status === "cancelled") {
    history.push(decision("Cancelled", decidedAt, params.employeeId, "Plans changed"));
  }

  await client.query(
    `INSERT INTO time_off_requests (
       employee_id, type_id, start_date, end_date, start_time, end_time,
       reason, unit, duration, charges, consumptions, status, history
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13::jsonb)`,
    [
      params.employeeId,
      params.typeId,
      params.startDate,
      params.endDate,
      params.startTime,
      params.endTime,
      params.reason,
      params.unit,
      params.duration,
      JSON.stringify(params.charges),
      JSON.stringify(params.consumptions),
      params.status,
      JSON.stringify(history),
    ],
  );
}

function businessDayCharges(startDate: Date, days: number): { date: string; amount: number }[] {
  const charges: { date: string; amount: number }[] = [];
  let cursor = new Date(startDate);

  while (charges.length < days) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      charges.push({ date: formatDate(cursor), amount: 1 });
    }
    cursor = addDays(cursor, 1);
  }

  return charges;
}

async function seedTimeOff(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const types = await upsertTypes(client);
    const pto = types.get("PTO")!;
    const sick = types.get("SICK")!;
    const compOff = types.get("COMP_OFF")!;

    const employees = await fetchEmployeePool(client, EMPLOYEE_POOL_SIZE);

    if (employees.length === 0) {
      throw new Error("no registered users found to attach time off to");
    }

    const approverId = await fetchApprover(client);
    const year = new Date().getFullYear();
    const validFrom = `${year}-01-01`;
    const validTo = `${year}-12-31`;

    let allocationsSeeded = 0;
    let requestsSeeded = 0;

    for (const [index, employee] of employees.entries()) {
      const ptoAllocationId = await insertAllocation(client, {
        employeeId: employee.id,
        typeId: pto.id,
        amount: PTO_ALLOCATION_DAYS,
        validFrom,
        validTo,
        approverId,
      });
      allocationsSeeded++;

      const compOffAllocationId = await insertAllocation(client, {
        employeeId: employee.id,
        typeId: compOff.id,
        amount: COMP_OFF_ALLOCATION_HOURS,
        validFrom,
        validTo,
        approverId,
      });
      allocationsSeeded++;

      // One approved, past PTO request that draws down the allocation above.
      const approvedStart = addDays(new Date(), -randomInt(30, 90));
      const approvedCharges = businessDayCharges(approvedStart, 3);
      await insertRequest(client, {
        employeeId: employee.id,
        typeId: pto.id,
        startDate: approvedCharges[0].date,
        endDate: approvedCharges[approvedCharges.length - 1].date,
        startTime: "",
        endTime: "",
        reason: "Family vacation",
        unit: "days",
        duration: approvedCharges.length,
        charges: approvedCharges,
        consumptions: approvedCharges.map((charge) => ({
          allocationId: ptoAllocationId,
          date: charge.date,
          amount: charge.amount,
        })),
        status: "approved",
        approverId,
      });
      requestsSeeded++;

      // One pending single-day PTO request awaiting approval.
      const pendingStart = addDays(new Date(), randomInt(7, 30));
      const pendingCharges = businessDayCharges(pendingStart, 1);
      await insertRequest(client, {
        employeeId: employee.id,
        typeId: pto.id,
        startDate: pendingCharges[0].date,
        endDate: pendingCharges[0].date,
        startTime: "",
        endTime: "",
        reason: "Personal errand",
        unit: "days",
        duration: 1,
        charges: pendingCharges,
        consumptions: [],
        status: "pending",
        approverId,
      });
      requestsSeeded++;

      // Sick leave needs no allocation: vary the status for demo purposes.
      const sickStatus = (["approved", "pending", "refused"] as const)[index % 3];
      const sickStart = addDays(new Date(), -randomInt(1, 20));
      const sickCharges = businessDayCharges(sickStart, 1);
      await insertRequest(client, {
        employeeId: employee.id,
        typeId: sick.id,
        startDate: sickCharges[0].date,
        endDate: sickCharges[0].date,
        startTime: "",
        endTime: "",
        reason: "Feeling unwell",
        unit: "days",
        duration: 1,
        charges: sickCharges,
        consumptions: [],
        status: sickStatus,
        approverId,
      });
      requestsSeeded++;

      // One approved hourly comp-off request on every third employee.
      if (index % 3 === 0) {
        const compDate = formatDate(addDays(new Date(), -randomInt(2, 15)));
        await insertRequest(client, {
          employeeId: employee.id,
          typeId: compOff.id,
          startDate: compDate,
          endDate: compDate,
          startTime: "10:00",
          endTime: "12:00",
          reason: "Weekend on-call coverage",
          unit: "hours",
          duration: 2,
          charges: [{ date: compDate, amount: 2 }],
          consumptions: [
            { allocationId: compOffAllocationId, date: compDate, amount: 2 },
          ],
          status: "approved",
          approverId,
        });
        requestsSeeded++;
      }
    }

    await client.query("COMMIT");
    logger.info(
      `seeded ${allocationsSeeded} allocations and ${requestsSeeded} requests for ${employees.length} employees across ${types.size} types`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seedTimeOff()
  .catch((error) => {
    logger.error({ err: error }, "seed-time-off failed");
    process.exit(1);
  })
  .finally(() => pool.end());
