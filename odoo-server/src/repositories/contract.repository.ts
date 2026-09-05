import { pool } from "../lib/db";
import { ContractRecord } from "../types/contract";

const CONTRACT_COLUMNS = `
    c.id AS "id",
    c.employee_id AS "employeeId",
    u.name AS "employeeName",
    u.email AS "employeeEmail",
    to_char(c.start_date, 'YYYY-MM-DD') AS "startDate",
    to_char(c.end_date, 'YYYY-MM-DD') AS "endDate",
    c.wage::float8 AS "wage",
    c.status AS "status",
    c.created_at AS "createdAt",
    c.updated_at AS "updatedAt"
`;

const CONTRACT_FROM = `
  FROM contracts c
  JOIN users u ON u.id = c.employee_id
`;

const UPDATABLE_COLUMNS: Record<string, string> = {
  startDate: "start_date",
  endDate: "end_date",
  wage: "wage",
  status: "status",
};

export type ContractFields = {
  startDate?: string;
  endDate?: string;
  wage?: number;
  status?: string;
};

export async function insertContract(input: {
  employeeId: string;
  startDate: string;
  endDate: string;
  wage: number;
  status: string;
}): Promise<ContractRecord> {
  const result = await pool.query<ContractRecord>(
    `WITH inserted AS (
       INSERT INTO contracts (employee_id, start_date, end_date, wage, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     )
     SELECT ${CONTRACT_COLUMNS}
     FROM inserted c
     JOIN users u ON u.id = c.employee_id`,
    [
      input.employeeId,
      input.startDate,
      input.endDate,
      input.wage,
      input.status,
    ],
  );

  return result.rows[0];
}

export async function findContractById(
  id: string,
): Promise<ContractRecord | null> {
  const result = await pool.query<ContractRecord>(
    `SELECT ${CONTRACT_COLUMNS} ${CONTRACT_FROM} WHERE c.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAllContracts(query: {
  limit: number;
  offset: number;
  status?: string;
  employeeId?: string;
  search?: string;
}): Promise<{ rows: ContractRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.status) {
    values.push(query.status);
    conditions.push(`c.status = $${values.length}`);
  }

  if (query.employeeId) {
    values.push(query.employeeId);
    conditions.push(`c.employee_id = $${values.length}`);
  }

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(u.name ILIKE $${values.length} OR u.email ILIKE $${values.length})`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(query.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(query.offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await pool.query<ContractRecord & { total: number }>(
    `SELECT COUNT(*) OVER()::int AS "total", ${CONTRACT_COLUMNS}
     ${CONTRACT_FROM}
     ${where}
     ORDER BY c.start_date DESC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );

  return {
    rows: result.rows.map(({ total, ...contract }) => contract),
    total: result.rows[0]?.total ?? 0,
  };
}

export async function updateContractById(
  id: string,
  fields: ContractFields,
): Promise<ContractRecord | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = fields[key as keyof ContractFields];

    if (value !== undefined) {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    }
  }

  assignments.push("updated_at = NOW()");
  values.push(id);

  const result = await pool.query<ContractRecord>(
    `WITH updated AS (
       UPDATE contracts
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *
     )
     SELECT ${CONTRACT_COLUMNS}
     FROM updated c
     JOIN users u ON u.id = c.employee_id`,
    values,
  );

  return result.rows[0] ?? null;
}

export async function deleteContractById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM contracts WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}
