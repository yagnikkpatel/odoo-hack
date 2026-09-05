import { AppError } from "../errors/AppError";

type PgError = { code?: string; constraint?: string; detail?: string };

/**
 * Postgres constraints are the backstop for rules the service also checks. When the database
 * is the one that catches a violation, the client must still see the documented error rather
 * than a 500 — an enforced rule that surfaces as a crash reads like a bug.
 */
const CONSTRAINT_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  contracts_no_overlap: {
    status: 409,
    code: "contract_overlap",
    message: "This employee already has a contract in force over part of that period.",
  },
  users_email_key: {
    status: 409,
    code: "duplicate_email",
    message: "That email address is already registered.",
  },
  employees_employee_number_key: {
    status: 409,
    code: "duplicate_employee_number",
    message: "That employee number is already in use.",
  },
  employees_work_email_key: {
    status: 409,
    code: "duplicate_work_email",
    message: "That work email is already in use by another employee.",
  },
  employees_user_id_key: {
    status: 409,
    code: "employee_already_linked",
    message: "That employee already has a user account.",
  },
  salary_rules_code_key: {
    status: 409,
    code: "duplicate_rule_code",
    message: "That salary rule code is already in use.",
  },
  payslips_payrun_id_employee_id_key: {
    status: 409,
    code: "duplicate_payslip",
    message: "That employee already has a payslip in this payrun.",
  },
  payslips_number_key: {
    status: 409,
    code: "duplicate_number",
    message: "That payslip number is already in use.",
  },
};

export function translatePgError(error: unknown): AppError | null {
  const pg = error as PgError;

  if (!pg?.code) {
    return null;
  }

  const known = pg.constraint ? CONSTRAINT_ERRORS[pg.constraint] : undefined;

  if (known) {
    return new AppError(known.status, known.message, known.code);
  }

  switch (pg.code) {
    case "23P01": // exclusion_violation
      return new AppError(
        409,
        "That change conflicts with an existing record.",
        "contract_overlap",
      );
    case "23505": // unique_violation
      return new AppError(409, "That record already exists.", "duplicate_record");
    case "23503": // foreign_key_violation
      return new AppError(
        409,
        "That record is referenced by other data, or refers to something that does not exist.",
        "in_use",
      );
    case "23514": // check_violation
      return new AppError(400, "That value is not allowed.", "validation_error");
    default:
      return null;
  }
}
