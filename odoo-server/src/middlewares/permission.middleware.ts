import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { getRolePermissions } from "../lib/permissions";
import { pool } from "../lib/db";

/**
 * Guards a route with one or more permission codes, **any-of** semantics: holding any listed
 * code admits the caller (BR-RBAC-1). Where a route lists both a broad code and its `_self`
 * variant, the service narrows the query — see `scopeToSelf`.
 *
 * Codes are checked, never role names, so the runtime-editable matrix stays authoritative.
 */
export function requirePermission(...codes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(401, "Authentication required.", "unauthorized");
      }

      const granted = await resolveCallerPermissions(req.user.role);

      if (!codes.some((code) => granted.has(code))) {
        throw new AppError(
          403,
          "You do not have permission to perform this action.",
          "forbidden",
        );
      }

      req.permissions = granted;

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Decides whether this caller sees everything or only their own rows. Returns the employee id
 * to filter by, or `null` for unrestricted access (BR-RBAC-2).
 */
export function scopeToSelf(req: Request, broadCode: string): string | null {
  if (req.permissions?.has(broadCode)) {
    return null;
  }

  if (!req.user?.employeeId) {
    throw new AppError(
      403,
      "Your account is not linked to an employee record.",
      "no_employee_record",
    );
  }

  return req.user.employeeId;
}

export async function resolveCallerPermissions(roleName: string): Promise<Set<string>> {
  const result = await pool.query<{ id: string }>(
    "SELECT id FROM roles WHERE name = $1",
    [roleName],
  );

  const role = result.rows[0];

  if (!role) {
    throw new AppError(403, "Unknown role.", "forbidden");
  }

  return getRolePermissions(role.id);
}
