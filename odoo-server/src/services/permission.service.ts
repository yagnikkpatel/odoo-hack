import { invalidateCache } from "../lib/cache";
import { findPermissionCodesByRole } from "../repositories/permission.repository";

function rolePermissionsCacheKey(roleName: string): string {
  return `role-permissions:${roleName}`;
}

export async function getRolePermissions(
  roleName: string,
): Promise<Set<string>> {
  // Permission revocations must apply to the next request, even if Redis is
  // unavailable or another request was populating a stale cache entry.
  const codes = await findPermissionCodesByRole(roleName);
  return new Set(codes);
}

export async function invalidateRolePermissions(
  roleName: string,
): Promise<void> {
  await invalidateCache([rolePermissionsCacheKey(roleName)]);
}
