import { Request } from "express";
import { AppError } from "../errors/AppError";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Express 5 types path params as `string | string[]`. This narrows to a string and rejects
 * malformed UUIDs up front — otherwise Postgres raises 22P02 and the caller sees a 500 for
 * what is really a not-found.
 */
export function uuidParam(req: Request, name: string): string {
  const raw = req.params[name];
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (!value || !UUID.test(value)) {
    throw new AppError(404, "Not found.", "not_found");
  }

  return value;
}

export function queryRecord(req: Request): Record<string, unknown> {
  return req.query as Record<string, unknown>;
}
