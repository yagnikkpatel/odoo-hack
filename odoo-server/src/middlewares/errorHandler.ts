import { NextFunction, Request, Response } from "express";
import { MulterError } from "multer";
import { logger } from "../lib/logger";
import { AppError } from "../errors/AppError";

type BodyParserError = Error & {
  status?: number;
  type?: string;
};

function isBodyParserError(err: Error): err is BodyParserError {
  const candidate = err as BodyParserError;

  return (
    typeof candidate.type === "string" && typeof candidate.status === "number"
  );
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });

    return;
  }

  if (err instanceof MulterError) {
    res.status(400).json({
      success: false,
      message:
        err.code === "LIMIT_FILE_SIZE"
          ? "Image must be 5MB or smaller"
          : err.message,
    });

    return;
  }

  if (isBodyParserError(err) && err.status && err.status < 500) {
    res.status(err.status).json({
      success: false,
      message:
        err.type === "entity.parse.failed"
          ? "Malformed JSON body"
          : err.message,
    });

    return;
  }

  logger.error({ err }, "Unhandled error");

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
