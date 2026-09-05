import { Pool, PoolClient } from "pg";
import { env } from "../config/env";

export const pool = new Pool({
  connectionString: env.databaseUrl,
});

/** Anything a repository can run against: the pool, or a client inside a transaction. */
export type Queryable = Pick<Pool, "query"> | Pick<PoolClient, "query">;

/**
 * Runs `fn` inside a single transaction (BR-X-7). Services own transactions and pass the
 * client down to repositories, so operations like leave approval can lock a row, re-read a
 * balance and write — all atomically.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");

    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
