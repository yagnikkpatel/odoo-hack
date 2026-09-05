import bcrypt from "bcryptjs";
import { z } from "zod";
import { AppError } from "../errors/AppError";
import { parsePageParams, buildPageMeta } from "../lib/pagination";
import { parseOrThrow } from "../lib/validate";
import * as roleRepository from "../repositories/role.repository";
import * as userRepository from "../repositories/user.repository";
import * as employeeRepository from "../repositories/employee.repository";
import { PageMeta } from "../types/common";
import { UserWithRoleRow, toEmployeeRef } from "../types/user";
import { MIN_PASSWORD_LENGTH, SALT_ROUNDS } from "./auth.service";

const SORTABLE = ["email", "created_at", "updated_at", "last_login_at"];

const createSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(MIN_PASSWORD_LENGTH),
  role_id: z.uuid(),
  employee_id: z.uuid().nullable().optional(),
});

const updateSchema = z
  .object({
    role_id: z.uuid().optional(),
    is_active: z.boolean().optional(),
    password: z.string().min(MIN_PASSWORD_LENGTH).optional(),
    employee_id: z.uuid().nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "at least one field is required",
  });

export async function list(query: Record<string, unknown>) {
  const params = parsePageParams(query, { sortable: SORTABLE, defaultSort: "created_at", defaultOrder: "desc" });

  const { rows, total } = await userRepository.list(params, {
    roleId: typeof query.role_id === "string" ? query.role_id : undefined,
    isActive: query.is_active === undefined ? undefined : query.is_active === "true",
  });

  return { rows: rows.map(present), meta: buildPageMeta(params, total) };
}

export async function getById(id: string) {
  const user = await userRepository.findById(id);

  if (!user) {
    throw new AppError(404, "User not found.", "not_found");
  }

  return present(user);
}

export async function create(input: unknown) {
  const data = parseOrThrow(createSchema, input);

  if (!(await roleRepository.findById(data.role_id))) {
    throw new AppError(400, "Unknown role.", "validation_error", [
      { field: "role_id", message: "no such role" },
    ]);
  }

  if (await userRepository.findByEmail(data.email)) {
    throw new AppError(409, "That email address is already registered.", "duplicate_email");
  }

  if (data.employee_id) {
    await assertEmployeeLinkable(data.employee_id, null);
  }

  const user = await userRepository.insert({
    email: data.email,
    passwordHash: await bcrypt.hash(data.password, SALT_ROUNDS),
    roleId: data.role_id,
  });

  if (data.employee_id) {
    await employeeRepository.linkUser(data.employee_id, user.id);
  }

  return present((await userRepository.findById(user.id)) as UserWithRoleRow);
}

export async function update(id: string, input: unknown) {
  const data = parseOrThrow(updateSchema, input);
  const existing = await userRepository.findById(id);

  if (!existing) {
    throw new AppError(404, "User not found.", "not_found");
  }

  // BR-RBAC-6: never let the system lose its last way in.
  const losingAdmin =
    existing.role_name === "admin" &&
    ((data.is_active === false && existing.is_active) ||
      (data.role_id !== undefined && data.role_id !== existing.role_id));

  if (losingAdmin && (await userRepository.countActiveAdmins()) <= 1) {
    throw new AppError(
      422,
      "This is the last active Admin account — demoting or deactivating it would lock everyone out.",
      "last_admin_protected",
    );
  }

  if (data.role_id !== undefined && !(await roleRepository.findById(data.role_id))) {
    throw new AppError(400, "Unknown role.", "validation_error", [
      { field: "role_id", message: "no such role" },
    ]);
  }

  if (data.employee_id !== undefined) {
    if (data.employee_id) {
      await assertEmployeeLinkable(data.employee_id, id);
      await employeeRepository.linkUser(data.employee_id, id);
    } else if (existing.employee_id) {
      await employeeRepository.linkUser(existing.employee_id, null);
    }
  }

  await userRepository.update(id, {
    roleId: data.role_id,
    isActive: data.is_active,
    passwordHash: data.password
      ? await bcrypt.hash(data.password, SALT_ROUNDS)
      : undefined,
  });

  return present((await userRepository.findById(id)) as UserWithRoleRow);
}

export async function deactivate(id: string): Promise<void> {
  const existing = await userRepository.findById(id);

  if (!existing) {
    throw new AppError(404, "User not found.", "not_found");
  }

  if (existing.role_name === "admin" && (await userRepository.countActiveAdmins()) <= 1) {
    throw new AppError(
      422,
      "This is the last active Admin account and cannot be deactivated.",
      "last_admin_protected",
    );
  }

  await userRepository.update(id, { isActive: false });
}

/** BR-EMP-6: one login per employee, at most. */
async function assertEmployeeLinkable(
  employeeId: string,
  linkingToUserId: string | null,
): Promise<void> {
  const employee = await employeeRepository.findById(employeeId);

  if (!employee) {
    throw new AppError(400, "Unknown employee.", "validation_error", [
      { field: "employee_id", message: "no such employee" },
    ]);
  }

  if (employee.user_id && employee.user_id !== linkingToUserId) {
    throw new AppError(
      409,
      "That employee already has a user account.",
      "employee_already_linked",
    );
  }
}

function present(user: UserWithRoleRow) {
  return {
    id: user.id,
    email: user.email,
    role_id: user.role_id,
    role_name: user.role_name,
    is_active: user.is_active,
    last_login_at: user.last_login_at,
    employee: toEmployeeRef(user),
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

