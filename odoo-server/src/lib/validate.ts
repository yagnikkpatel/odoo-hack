import { z, ZodType } from "zod";
import { AppError } from "../errors/AppError";

export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    throw new AppError(400, z.prettifyError(parsed.error));
  }

  return parsed.data;
}
