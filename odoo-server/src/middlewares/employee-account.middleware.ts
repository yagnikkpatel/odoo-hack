import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { getCurrentAuthUser } from "../services/current-auth-user.service";

// Employee permissions must use today's account role, not the role embedded in
// a previously issued JWT. This also blocks deleted or deactivated accounts.
export async function requireCurrentEmployeeAccount(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    throw new AppError(401, "Authentication required");
  }

  const user = await getCurrentAuthUser(req.user.userId);
  req.user = { userId: user.id, email: user.email, role: user.role };
  next();
}
