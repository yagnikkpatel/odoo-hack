import { PoolClient } from "pg";
import { pool } from "../lib/db";
import { SalaryStructureRecord } from "../types/payroll";

const STRUCTURE_COLUMNS = `
    s.id AS "id",
    s.name AS "name",
    s.description AS "description",
    s.active AS "active",
    COALESCE(
      (
        SELECT array_agg(sr.rule_id ORDER BY r.sequence ASC, r.code ASC)
        FROM salary_structure_rules sr
        JOIN salary_rules r ON r.id = sr.rule_id
        WHERE sr.structure_id = s.id
      ),
      ARRAY[]::uuid[]
    ) AS "ruleIds",
    (
      SELECT COUNT(DISTINCT p.employee_id)::int
      FROM payruns run
      JOIN payrun_employees p ON p.payrun_id = run.id
      WHERE run.structure_id = s.id
    ) AS "employeeCount",
    s.created_at AS "createdAt",
    s.updated_at AS "updatedAt"
`;

export type SalaryStructureFields = {
  name?: string;
  description?: string;
  active?: boolean;
};

async function replaceStructureRules(
  client: PoolClient,
  structureId: string,
  ruleIds: string[],
): Promise<void> {
  await client.query(
    "DELETE FROM salary_structure_rules WHERE structure_id = $1 AND rule_id <> ALL($2::uuid[])",
    [structureId, ruleIds],
  );

  await client.query(
    `INSERT INTO salary_structure_rules (structure_id, rule_id)
     SELECT $1, unnest($2::uuid[])
     ON CONFLICT DO NOTHING`,
    [structureId, ruleIds],
  );
}

/**
 * Sequences are a property of the rule, not of the membership row, so reordering
 * a structure renumbers the rules themselves -- inside the same transaction as
 * the membership change so a failure never leaves a half-reordered structure.
 */
async function applyRuleSequences(
  client: PoolClient,
  sequences: { id: string; sequence: number }[],
): Promise<void> {
  if (sequences.length === 0) {
    return;
  }

  await client.query(
    `UPDATE salary_rules AS r
     SET sequence = input.sequence, updated_at = NOW()
     FROM (
       SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS sequence
     ) AS input
     WHERE r.id = input.id`,
    [sequences.map((item) => item.id), sequences.map((item) => item.sequence)],
  );
}

async function selectStructure(
  client: PoolClient,
  id: string,
): Promise<SalaryStructureRecord> {
  const result = await client.query<SalaryStructureRecord>(
    `SELECT ${STRUCTURE_COLUMNS} FROM salary_structures s WHERE s.id = $1`,
    [id],
  );

  return result.rows[0];
}

export async function insertSalaryStructure(input: {
  name: string;
  description: string;
  active: boolean;
  ruleIds: string[];
  ruleSequences: { id: string; sequence: number }[];
}): Promise<SalaryStructureRecord> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const inserted = await client.query<{ id: string }>(
      `INSERT INTO salary_structures (name, description, active)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [input.name, input.description, input.active],
    );

    const id = inserted.rows[0].id;

    await applyRuleSequences(client, input.ruleSequences);
    await replaceStructureRules(client, id, input.ruleIds);

    const structure = await selectStructure(client, id);

    await client.query("COMMIT");

    return structure;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findSalaryStructureById(
  id: string,
): Promise<SalaryStructureRecord | null> {
  const result = await pool.query<SalaryStructureRecord>(
    `SELECT ${STRUCTURE_COLUMNS} FROM salary_structures s WHERE s.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAllSalaryStructures(query: {
  limit: number;
  offset: number;
  search?: string;
  active?: boolean;
}): Promise<{ rows: SalaryStructureRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(s.name ILIKE $${values.length} OR s.description ILIKE $${values.length})`,
    );
  }

  if (query.active !== undefined) {
    values.push(query.active);
    conditions.push(`s.active = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(query.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(query.offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await pool.query<SalaryStructureRecord & { total: number }>(
    `SELECT COUNT(*) OVER()::int AS "total", ${STRUCTURE_COLUMNS}
     FROM salary_structures s
     ${where}
     ORDER BY s.name ASC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );

  return {
    rows: result.rows.map(({ total, ...structure }) => structure),
    total: result.rows[0]?.total ?? 0,
  };
}

export async function updateSalaryStructureById(
  id: string,
  fields: SalaryStructureFields,
  ruleIds?: string[],
  ruleSequences: { id: string; sequence: number }[] = [],
): Promise<SalaryStructureRecord | null> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const assignments: string[] = [];
    const values: unknown[] = [];

    for (const [key, column] of Object.entries({
      name: "name",
      description: "description",
      active: "active",
    })) {
      const value = fields[key as keyof SalaryStructureFields];

      if (value !== undefined) {
        values.push(value);
        assignments.push(`${column} = $${values.length}`);
      }
    }

    assignments.push("updated_at = NOW()");
    values.push(id);

    const updated = await client.query<{ id: string }>(
      `UPDATE salary_structures
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING id`,
      values,
    );

    if (updated.rowCount === 0) {
      await client.query("ROLLBACK");

      return null;
    }

    await applyRuleSequences(client, ruleSequences);

    if (ruleIds) {
      await replaceStructureRules(client, id, ruleIds);
    }

    const structure = await selectStructure(client, id);

    await client.query("COMMIT");

    return structure;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteSalaryStructureById(
  id: string,
): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM salary_structures WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

export async function countPayrunsUsingStructure(id: string): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS "count" FROM payruns WHERE structure_id = $1`,
    [id],
  );

  return result.rows[0]?.count ?? 0;
}
