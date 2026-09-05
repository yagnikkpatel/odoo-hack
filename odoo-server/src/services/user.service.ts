import bcrypt from "bcryptjs";
import { AppError } from "../errors/AppError";
import {
  deleteUserById,
  findAllUsers,
  findRoleIdByName,
  findUserById,
  insertUser,
  updateUser,
} from "../repositories/user.repository";
import { CreateUserInput, UpdateUserInput } from "../types/user.dto";
import { UserRecord } from "../types/user";

const SALT_ROUNDS = 12;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "23505"
  );
}

async function resolveRoleId(roleName: string): Promise<string> {
  const roleId = await findRoleIdByName(roleName);

  if (!roleId) {
    throw new AppError(400, `Unknown role: ${roleName}`);
  }

  return roleId;
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const roleId = await resolveRoleId(input.role);
  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);

  try {
    return await insertUser({
      name: input.name,
      email: input.email,
      passwordHash,
      roleId,
      status: input.status,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "Email already in use");
    }

    throw error;
  }
}

export async function listUsers(): Promise<UserRecord[]> {
  return findAllUsers();
}

export async function getUserById(id: string): Promise<UserRecord> {
  const user = await findUserById(id);

  if (!user) {
    throw new AppError(404, "User not found");
  }

  return user;
}

export async function updateUserById(
  id: string,
  input: UpdateUserInput,
): Promise<UserRecord> {
  const roleId = input.role ? await resolveRoleId(input.role) : undefined;

  try {
    const user = await updateUser(id, {
      name: input.name,
      email: input.email,
      status: input.status,
      roleId,
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return user;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "Email already in use");
    }

    throw error;
  }
}

export async function removeUserById(id: string): Promise<string> {
  const deletedId = await deleteUserById(id);

  if (!deletedId) {
    throw new AppError(404, "User not found");
  }

  return deletedId;
}
