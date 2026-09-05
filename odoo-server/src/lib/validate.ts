import { ZodError, ZodType } from "zod";
import { AppError } from "../errors/AppError";

/**
 * Parses `input` against `schema`, turning a Zod failure into the documented
 * `400 validation_error` with a per-field `details[]` (BR-X-4).
 */
export function parseOrThrow<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw new AppError(400, "Validation failed.", "validation_error", toDetails(result.error));
  }

  return result.data;
}

function toDetails(error: ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "(body)",
    message: issue.message,
  }));
}

/**
 * Derived fields are rejected, not silently dropped (BR-X-5) — a client sending
 * `worked_hours` has a bug, and swallowing it hides that.
 */
export function rejectReadOnlyFields(
  body: Record<string, unknown>,
  fields: string[],
): void {
  const present = fields.filter((field) => body[field] !== undefined);

  if (present.length > 0) {
    throw new AppError(
      400,
      `These fields are derived by the server and cannot be set: ${present.join(", ")}.`,
      "read_only_field",
      present.map((field) => ({ field, message: "read-only" })),
    );
  }
}
