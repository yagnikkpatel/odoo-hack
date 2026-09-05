import bcrypt from "bcryptjs";
import { AppError } from "../errors/AppError";
import { getCached, invalidateCache, setCached } from "../lib/cache";
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

const USER_LIST_CACHE_KEY = "users:all";

function userCacheKey(id: string): string {
  return `user:${id}`;
}

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
    const user = await insertUser({
      name: input.name,
      email: input.email,
      passwordHash,
      roleId,
      status: input.status,
    });

    await invalidateCache([USER_LIST_CACHE_KEY]);

    return user;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(409, "Email already in use");
    }

    throw error;
  }
}

export async function listUsers(): Promise<UserRecord[]> {
  const cached = await getCached<UserRecord[]>(USER_LIST_CACHE_KEY);

  if (cached) {
    return cached;
  }

  const users = await findAllUsers();

  await setCached(USER_LIST_CACHE_KEY, users);

  return users;
}

export async function getUserById(id: string): Promise<UserRecord> {
  const cacheKey = userCacheKey(id);
  const cached = await getCached<UserRecord>(cacheKey);

  if (cached) {
    return cached;
  }

  const user = await findUserById(id);

  if (!user) {
    throw new AppError(404, "User not found");
  }

  await setCached(cacheKey, user);

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

    await invalidateCache([USER_LIST_CACHE_KEY, userCacheKey(id)]);

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

  await invalidateCache([USER_LIST_CACHE_KEY, userCacheKey(id)]);

  return deletedId;
}
