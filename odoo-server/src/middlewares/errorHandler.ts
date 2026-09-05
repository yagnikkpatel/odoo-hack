import { NextFunction, Request, Response } from "express";
import { logger } from "../lib/logger";
import { AppError } from "../errors/AppError";
import { translatePgError } from "../lib/pgError";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const appError = err instanceof AppError ? err : translatePgError(err);

  if (appError) {
    res.status(appError.statusCode).json({
      success: false,
      message: appError.message,
      code: appError.code,
      ...(appError.details ? { details: appError.details } : {}),
    });

    return;
  }

  logger.error({ err }, "Unhandled error");

  res.status(500).json({
    success: false,
    message: "Internal server error",
    code: "internal_error",
  });
}
