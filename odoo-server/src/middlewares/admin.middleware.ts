import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";

export function requireAdmin(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.user?.role !== "ADMIN") {
    next(
      new AppError(
        403,
        "Admin access required. You do not have admin access it seems",
      ),
    );
    return;
  }

  next();
}
