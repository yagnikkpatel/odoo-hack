import { getCached, invalidateCache, setCached } from "../lib/cache";
import { findPermissionCodesByRole } from "../repositories/permission.repository";

function rolePermissionsCacheKey(roleName: string): string {
  return `role-permissions:${roleName}`;
}

export async function getRolePermissions(
  roleName: string,
): Promise<Set<string>> {
  const cacheKey = rolePermissionsCacheKey(roleName);
  const cached = await getCached<string[]>(cacheKey);

  if (cached) {
    return new Set(cached);
  }

  const codes = await findPermissionCodesByRole(roleName);

  await setCached(cacheKey, codes);

  return new Set(codes);
}

export async function invalidateRolePermissions(
  roleName: string,
): Promise<void> {
  await invalidateCache([rolePermissionsCacheKey(roleName)]);
}
