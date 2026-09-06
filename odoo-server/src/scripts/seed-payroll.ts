import type { PoolClient } from "pg";
import { pool } from "../lib/db";
import { logger } from "../lib/logger";

type RuleInput = {
  name: string;
  code: string;
  category: string;
  sequence: number;
  method: string;
  amount?: number;
  percentage?: number;
  base?: string;
  formula?: string;
};

/**
 * A worked example of each computation method: fixed amounts, percentages of an
 * earlier rule, and formulas over the payroll inputs (loss of pay reads the
 * period's unpaid leave).
 */
const RULES: RuleInput[] = [
  {
    name: "Basic Salary",
    code: "BASIC",
    category: "basic",
    sequence: 1,
    method: "percentage",
    percentage: 50,
    base: "WAGE",
  },
  {
    name: "Contractor Fee",
    code: "CFEE",
    category: "basic",
    sequence: 2,
    method: "formula",
    formula: "WAGE",
  },
  {
    name: "House Rent Allowance",
    code: "HRA",
    category: "allowance",
    sequence: 10,
    method: "percentage",
    percentage: 40,
    base: "BASIC",
  },
  {
    name: "Standard Allowance",
    code: "STD",
    category: "allowance",
    sequence: 20,
    method: "fixed",
    amount: 5000,
  },
  {
    name: "Performance Bonus",
    code: "BONUS",
    category: "allowance",
    sequence: 30,
    method: "fixed",
    amount: 0,
  },
  {
    name: "Leave Travel Allowance",
    code: "LTA",
    category: "allowance",
    sequence: 40,
    method: "fixed",
    amount: 1500,
  },
  {
    name: "Fixed Allowance",
    code: "FIX",
    category: "allowance",
    sequence: 50,
    method: "formula",
    formula: "WAGE - BASIC - HRA - STD - LTA",
  },
  {
    name: "Gross Salary",
    code: "GROSS",
    category: "gross",
    sequence: 60,
    method: "formula",
    formula: "BASIC + HRA + STD + BONUS + LTA + FIX",
  },
  {
    name: "Loss of Pay",
    code: "LOP",
    category: "deduction",
    sequence: 70,
    method: "formula",
    formula: "GROSS / PERIOD_DAYS * UNPAID_DAYS",
  },
  {
    name: "LWF Fund",
    code: "LWF",
    category: "deduction",
    sequence: 75,
    method: "fixed",
    amount: 25,
  },
  {
    name: "Provident Fund",
    code: "PF",
    category: "deduction",
    sequence: 80,
    method: "percentage",
    percentage: 12,
    base: "BASIC",
  },
  {
    name: "ESIC",
    code: "ESIC",
    category: "deduction",
    sequence: 90,
    method: "percentage",
    percentage: 0.75,
    base: "GROSS",
  },
  {
    name: "Professional Tax",
    code: "PT",
    category: "deduction",
    sequence: 100,
    method: "fixed",
    amount: 200,
  },
  {
    name: "Tax Deducted at Source",
    code: "TDS",
    category: "deduction",
    sequence: 105,
    method: "percentage",
    percentage: 10,
    base: "CFEE",
  },
  {
    name: "Net Salary",
    code: "NET",
    category: "net",
    sequence: 110,
    method: "formula",
    formula: "GROSS - LOP - LWF - PF - ESIC - PT",
  },
];

/**
 * A formula may only reference codes that also run in the same structure, so
 * each structure lists a self-contained set. Intern and Contractor omit the
 * GROSS and NET rules: without them the payslip totals basic + allowances and
 * subtracts the deductions on its own.
 */
const STRUCTURES: { name: string; description: string; codes: string[] }[] = [
  {
    name: "Regular Salary",
    description: "Monthly salary for permanent employees.",
    codes: [
      "BASIC",
      "HRA",
      "STD",
      "BONUS",
      "LTA",
      "FIX",
      "GROSS",
      "LOP",
      "LWF",
      "PF",
      "ESIC",
      "PT",
      "NET",
    ],
  },
  {
    name: "Intern Salary",
    description: "Stipend structure without statutory contributions.",
    codes: ["BASIC", "STD", "PT"],
  },
  {
    name: "Contractor",
    description: "Full contract wage with tax withheld at source.",
    codes: ["CFEE", "TDS"],
  },
];

async function seedRules(client: PoolClient): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const rule of RULES) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO salary_rules
         (name, code, category, sequence, method, amount, percentage, base, formula)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (code) DO UPDATE
         SET name = EXCLUDED.name,
             category = EXCLUDED.category,
             sequence = EXCLUDED.sequence,
             method = EXCLUDED.method,
             amount = EXCLUDED.amount,
             percentage = EXCLUDED.percentage,
             base = EXCLUDED.base,
             formula = EXCLUDED.formula,
             updated_at = NOW()
       RETURNING id`,
      [
        rule.name,
        rule.code,
        rule.category,
        rule.sequence,
        rule.method,
        rule.amount ?? 0,
        rule.percentage ?? 0,
        rule.base ?? "",
        rule.formula ?? "",
      ],
    );

    ids.set(rule.code, result.rows[0].id);
  }

  return ids;
}

async function seedStructures(
  client: PoolClient,
  ruleIds: Map<string, string>,
): Promise<number> {
  for (const structure of STRUCTURES) {
    const result = await client.query<{ id: string }>(
      `INSERT INTO salary_structures (name, description)
       VALUES ($1, $2)
       ON CONFLICT (lower(name)) DO UPDATE
         SET description = EXCLUDED.description, updated_at = NOW()
       RETURNING id`,
      [structure.name, structure.description],
    );

    const structureId = result.rows[0].id;
    const memberIds = structure.codes.map((code) => ruleIds.get(code)!);

    await client.query(
      "DELETE FROM salary_structure_rules WHERE structure_id = $1 AND rule_id <> ALL($2::uuid[])",
      [structureId, memberIds],
    );

    await client.query(
      `INSERT INTO salary_structure_rules (structure_id, rule_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [structureId, memberIds],
    );
  }

  return STRUCTURES.length;
}

async function seedPayroll(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const ruleIds = await seedRules(client);
    const structures = await seedStructures(client, ruleIds);

    await client.query("COMMIT");

    logger.info(
      `seeded ${ruleIds.size} salary rules across ${structures} salary structures`,
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seedPayroll()
  .catch((error) => {
    logger.error({ err: error }, "seed-payroll failed");
    process.exit(1);
  })
  .finally(() => pool.end());
