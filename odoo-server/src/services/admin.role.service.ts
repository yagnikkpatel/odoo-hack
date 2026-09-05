import { z } from "zod";
import { AppError } from "../errors/AppError";
import { withTransaction } from "../lib/db";
import { invalidateRolePermissions } from "../lib/permissions";
import { parseOrThrow } from "../lib/validate";
import * as permissionRepository from "../repositories/permission.repository";
import * as roleRepository from "../repositories/role.repository";

const MODULES = [
  "employee",
  "contract",
  "attendance",
  "time_off",
  "payroll",
  "config",
  "admin",
] as const;

const setPermissionsSchema = z.object({
  permission_codes: z.array(z.string()).max(200),
});

export async function listRoles() {
  return (await roleRepository.listWithCounts()).map((role) => ({
    id: role.id,
    name: role.name,
    label: role.label,
    permission_count: Number(role.permission_count ?? 0),
    user_count: Number(role.user_count ?? 0),
  }));
}

export async function listPermissions(query: Record<string, unknown>) {
  const module = query.module === undefined ? undefined : String(query.module);

  if (module && !MODULES.includes(module as (typeof MODULES)[number])) {
    throw new AppError(400, `Unknown module "${module}".`, "validation_error", [
      { field: "module", message: `must be one of: ${MODULES.join(", ")}` },
    ]);
  }

  return permissionRepository.list({ module });
}

export async function getRolePermissions(roleId: string) {
  if (!(await roleRepository.findById(roleId))) {
    throw new AppError(404, "Role not found.", "not_found");
  }

  return permissionRepository.findByRole(roleId);
}

/**
 * Wholesale replace of a role's grants (BR-RBAC-3), in one transaction (BR-X-7).
 * BR-RBAC-6 stops an Admin from revoking their own ability to undo the change.
 */
export async function setRolePermissions(
  roleId: string,
  input: unknown,
  callerRole: string,
) {
  const { permission_codes } = parseOrThrow(setPermissionsSchema, input);
  const role = await roleRepository.findById(roleId);

  if (!role) {
    throw new AppError(404, "Role not found.", "not_found");
  }

  const requested = [...new Set(permission_codes)];
  const found = await permissionRepository.findByCodes(requested);

  if (found.length !== requested.length) {
    const known = new Set(found.map((p) => p.code));

    throw new AppError(400, "Unknown permission code.", "validation_error",
      requested
        .filter((code) => !known.has(code))
        .map((code) => ({ field: "permission_codes", message: `no such permission: ${code}` })),
    );
  }

  if (
    role.name === callerRole &&
    !requested.includes("admin.role.manage")
  ) {
    throw new AppError(
      422,
      "You cannot remove admin.role.manage from your own role — no one would be able to restore it.",
      "last_admin_protected",
    );
  }

  await withTransaction(async (client) => {
    await permissionRepository.replaceRolePermissions(
      roleId,
      found.map((p) => p.id),
      client,
    );
  });

  await invalidateRolePermissions(roleId);

  return permissionRepository.findByRole(roleId);
}
