import { pool } from "./db";
import { redis } from "./redis";
import { logger } from "./logger";

const CACHE_PREFIX = "rbac:permissions:";
const CACHE_TTL_SECONDS = 60;

/**
 * Resolves a role's permission codes from `role_permissions` (BR-RBAC-3). The set is data,
 * never a hardcoded map, so an Admin editing the matrix takes effect within the TTL.
 *
 * Redis is a cache, not a dependency: if it is down we read Postgres and carry on.
 */
export async function getRolePermissions(roleId: string): Promise<Set<string>> {
  const key = `${CACHE_PREFIX}${roleId}`;

  try {
    const cached = await redis.get(key);

    if (cached) {
      return new Set(JSON.parse(cached) as string[]);
    }
  } catch (error) {
    logger.warn({ err: error }, "permission cache read failed, falling back to postgres");
  }

  const result = await pool.query<{ code: string }>(
    `SELECT p.code
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.code`,
    [roleId],
  );

  const codes = result.rows.map((row) => row.code);

  try {
    await redis.set(key, JSON.stringify(codes), "EX", CACHE_TTL_SECONDS);
  } catch (error) {
    logger.warn({ err: error }, "permission cache write failed");
  }

  return new Set(codes);
}

export async function invalidateRolePermissions(roleId: string): Promise<void> {
  try {
    await redis.del(`${CACHE_PREFIX}${roleId}`);
  } catch (error) {
    logger.warn({ err: error }, "permission cache invalidation failed");
  }
}
