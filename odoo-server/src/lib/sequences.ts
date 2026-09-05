import { PoolClient } from "pg";

type SequenceRow = {
  prefix: string;
  next_value: string;
  padding: number;
  period_scope: "none" | "year" | "month";
  scope_key: string | null;
};

/**
 * Allocates the next reference number for `key` (BR-X-9).
 *
 * Must run inside the caller's transaction. `SELECT ... FOR UPDATE` holds the row for the rest
 * of the transaction, so concurrent creates serialise here instead of colliding on the unique
 * index, and a rollback consumes no number. `MAX(...) + 1` offers neither property.
 */
export async function allocateNumber(
  client: PoolClient,
  key: string,
  on: Date = new Date(),
): Promise<string> {
  const locked = await client.query<SequenceRow>(
    `SELECT prefix, next_value::text, padding, period_scope, scope_key
       FROM number_sequences
      WHERE key = $1
        FOR UPDATE`,
    [key],
  );

  const row = locked.rows[0];

  if (!row) {
    throw new Error(`unknown number sequence: ${key}`);
  }

  const scope = scopeFor(row.period_scope, on);
  // A new period restarts the counter, so payslip numbers read SLIP/2026/03/0001 in March.
  const rolledOver = row.period_scope !== "none" && row.scope_key !== scope.key;
  const allocated = rolledOver ? 1 : Number(row.next_value);

  await client.query(
    `UPDATE number_sequences
        SET next_value = $2, scope_key = $3, updated_at = NOW()
      WHERE key = $1`,
    [key, allocated + 1, scope.key],
  );

  return render(row, scope, allocated);
}

function render(
  row: SequenceRow,
  scope: { key: string | null; year: string; month: string },
  allocated: number,
): string {
  const counter = String(allocated).padStart(row.padding, "0");

  switch (row.period_scope) {
    case "year":
      return `${row.prefix}${scope.year}/${counter}`;
    case "month":
      return `${row.prefix}${scope.year}/${scope.month}/${counter}`;
    default:
      return `${row.prefix}${counter}`;
  }
}

function scopeFor(
  periodScope: SequenceRow["period_scope"],
  on: Date,
): { key: string | null; year: string; month: string } {
  const year = String(on.getUTCFullYear());
  const month = String(on.getUTCMonth() + 1).padStart(2, "0");

  switch (periodScope) {
    case "year":
      return { key: year, year, month };
    case "month":
      return { key: `${year}-${month}`, year, month };
    default:
      return { key: null, year, month };
  }
}
