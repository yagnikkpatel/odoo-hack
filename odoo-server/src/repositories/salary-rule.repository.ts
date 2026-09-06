import { pool } from "../lib/db";
import { SalaryRuleRecord } from "../types/payroll";

const RULE_COLUMNS = `
    r.id AS "id",
    r.name AS "name",
    r.code AS "code",
    r.category AS "category",
    r.sequence AS "sequence",
    r.method AS "method",
    r.amount::float8 AS "amount",
    r.percentage::float8 AS "percentage",
    r.base AS "base",
    r.formula AS "formula",
    r.quantity::float8 AS "quantity",
    r.active AS "active",
    r.created_at AS "createdAt",
    r.updated_at AS "updatedAt"
`;

const UPDATABLE_COLUMNS: Record<string, string> = {
  name: "name",
  code: "code",
  category: "category",
  sequence: "sequence",
  method: "method",
  amount: "amount",
  percentage: "percentage",
  base: "base",
  formula: "formula",
  quantity: "quantity",
  active: "active",
};

export type SalaryRuleFields = {
  name?: string;
  code?: string;
  category?: string;
  sequence?: number;
  method?: string;
  amount?: number;
  percentage?: number;
  base?: string;
  formula?: string;
  quantity?: number;
  active?: boolean;
};

export async function insertSalaryRule(input: {
  name: string;
  code: string;
  category: string;
  sequence: number;
  method: string;
  amount: number;
  percentage: number;
  base: string;
  formula: string;
  quantity: number;
  active: boolean;
}): Promise<SalaryRuleRecord> {
  const result = await pool.query<SalaryRuleRecord>(
    `WITH inserted AS (
       INSERT INTO salary_rules
         (name, code, category, sequence, method, amount, percentage, base, formula, quantity, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *
     )
     SELECT ${RULE_COLUMNS} FROM inserted r`,
    [
      input.name,
      input.code,
      input.category,
      input.sequence,
      input.method,
      input.amount,
      input.percentage,
      input.base,
      input.formula,
      input.quantity,
      input.active,
    ],
  );

  return result.rows[0];
}

export async function findSalaryRuleById(
  id: string,
): Promise<SalaryRuleRecord | null> {
  const result = await pool.query<SalaryRuleRecord>(
    `SELECT ${RULE_COLUMNS} FROM salary_rules r WHERE r.id = $1`,
    [id],
  );

  return result.rows[0] ?? null;
}

export async function findAllSalaryRules(query: {
  limit: number;
  offset: number;
  search?: string;
  category?: string;
  structureId?: string;
  active?: boolean;
}): Promise<{ rows: SalaryRuleRecord[]; total: number }> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  if (query.search) {
    values.push(`%${query.search}%`);
    conditions.push(
      `(r.name ILIKE $${values.length} OR r.code ILIKE $${values.length})`,
    );
  }

  if (query.category) {
    values.push(query.category);
    conditions.push(`r.category = $${values.length}`);
  }

  if (query.active !== undefined) {
    values.push(query.active);
    conditions.push(`r.active = $${values.length}`);
  }

  if (query.structureId) {
    values.push(query.structureId);
    conditions.push(
      `EXISTS (
         SELECT 1 FROM salary_structure_rules sr
         WHERE sr.rule_id = r.id AND sr.structure_id = $${values.length}
       )`,
    );
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  values.push(query.limit);
  const limitPlaceholder = `$${values.length}`;
  values.push(query.offset);
  const offsetPlaceholder = `$${values.length}`;

  const result = await pool.query<SalaryRuleRecord & { total: number }>(
    `SELECT COUNT(*) OVER()::int AS "total", ${RULE_COLUMNS}
     FROM salary_rules r
     ${where}
     ORDER BY r.sequence ASC, r.code ASC
     LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
    values,
  );

  return {
    rows: result.rows.map(({ total, ...rule }) => rule),
    total: result.rows[0]?.total ?? 0,
  };
}

/** Every rule of a structure, active or not, in execution order. */
export async function findRulesForStructure(
  structureId: string,
): Promise<SalaryRuleRecord[]> {
  const result = await pool.query<SalaryRuleRecord>(
    `SELECT ${RULE_COLUMNS}
     FROM salary_structure_rules sr
     JOIN salary_rules r ON r.id = sr.rule_id
     WHERE sr.structure_id = $1
     ORDER BY r.sequence ASC, r.code ASC`,
    [structureId],
  );

  return result.rows;
}

export async function findSalaryRulesByIds(
  ids: string[],
): Promise<SalaryRuleRecord[]> {
  if (ids.length === 0) {
    return [];
  }

  const result = await pool.query<SalaryRuleRecord>(
    `SELECT ${RULE_COLUMNS} FROM salary_rules r WHERE r.id = ANY($1::uuid[])`,
    [ids],
  );

  return result.rows;
}

export async function updateSalaryRuleById(
  id: string,
  fields: SalaryRuleFields,
): Promise<SalaryRuleRecord | null> {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [key, column] of Object.entries(UPDATABLE_COLUMNS)) {
    const value = fields[key as keyof SalaryRuleFields];

    if (value !== undefined) {
      values.push(value);
      assignments.push(`${column} = $${values.length}`);
    }
  }

  assignments.push("updated_at = NOW()");
  values.push(id);

  const result = await pool.query<SalaryRuleRecord>(
    `WITH updated AS (
       UPDATE salary_rules
       SET ${assignments.join(", ")}
       WHERE id = $${values.length}
       RETURNING *
     )
     SELECT ${RULE_COLUMNS} FROM updated r`,
    values,
  );

  return result.rows[0] ?? null;
}

export async function deleteSalaryRuleById(id: string): Promise<string | null> {
  const result = await pool.query<{ id: string }>(
    "DELETE FROM salary_rules WHERE id = $1 RETURNING id",
    [id],
  );

  return result.rows[0]?.id ?? null;
}

export async function countStructuresUsingRule(id: string): Promise<number> {
  const result = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS "count"
     FROM salary_structure_rules
     WHERE rule_id = $1`,
    [id],
  );

  return result.rows[0]?.count ?? 0;
}
