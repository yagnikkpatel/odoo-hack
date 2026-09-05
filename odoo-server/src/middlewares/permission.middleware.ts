import { NextFunction, Request, RequestHandler, Response } from "express";
import { AppError } from "../errors/AppError";
import { getRolePermissions } from "../services/permission.service";

export function requirePermission(code: string): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, "Authentication required");
    }

    const permissions = await getRolePermissions(req.user.role);

    if (!permissions.has(code)) {
      throw new AppError(403, `Missing required permission: ${code}`);
    }

    next();
  };
}

export function requireScopedPermission(
  action: string,
  paramName = "userId",
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, "Authentication required");
    }

    const permissions = await getRolePermissions(req.user.role);

    if (permissions.has(`${action}:any`)) {
      next();

      return;
    }

    if (
      permissions.has(`${action}:own`) &&
      req.params[paramName] === req.user.userId
    ) {
      next();

      return;
    }

    throw new AppError(
      403,
      `Missing required permission: ${action}:any or ${action}:own on your own record`,
    );
  };
}

/**
 * Passes when the caller holds at least one of the codes. Used where a route is
 * open to both scopes and the service does the narrowing (own vs any).
 */
export function requireAnyPermission(...codes: string[]): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new AppError(401, "Authentication required");
    }

    const permissions = await getRolePermissions(req.user.role);

    if (codes.some((code) => permissions.has(code))) {
      next();

      return;
    }

    throw new AppError(
      403,
      `Missing required permission: one of ${codes.join(", ")}`,
    );
  };
}
