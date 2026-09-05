import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { verifyAccessToken } from "../lib/jwt";

const BEARER_PREFIX = "Bearer ";

/**
 * Verifies the Bearer token and attaches the payload to `req.user` (BR-AUTH-3).
 * Identity comes from here and nowhere else — never from the request body (BR-RBAC-2).
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;

    if (!header?.startsWith(BEARER_PREFIX)) {
      throw new AppError(401, "Authentication required.", "unauthorized");
    }

    req.user = verifyAccessToken(header.slice(BEARER_PREFIX.length).trim());

    next();
  } catch (error) {
    next(error);
  }
}
