import bcrypt from "bcryptjs";
import { z } from "zod";
import { AppError } from "../errors/AppError";
import { signAccessToken } from "../lib/jwt";
import { parseOrThrow } from "../lib/validate";
import { resolveCallerPermissions } from "../middlewares/permission.middleware";
import * as userRepository from "../repositories/user.repository";
import { EmployeeRef, RoleName, TokenPayload, toEmployeeRef } from "../types/user";
import { env } from "../config/env";

export const SALT_ROUNDS = 12;
export const MIN_PASSWORD_LENGTH = 8;

const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH),
});

export type SessionUser = {
  user_id: string;
  email: string;
  role: RoleName;
  role_label: string;
  permissions: string[];
  employee: EmployeeRef | null;
};

export async function login(input: unknown): Promise<{
  accessToken: string;
  expiresIn: number;
  user: SessionUser;
}> {
  const { email, password } = parseOrThrow(loginSchema, input);
  const user = await userRepository.findByEmail(email);

  // BR-AUTH-4: an unknown email and a wrong password are indistinguishable to the caller.
  // The bcrypt compare still runs on a dummy hash so the timing does not leak either.
  const passwordMatches = await bcrypt.compare(
    password,
    user?.password_hash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin",
  );

  if (!user || !passwordMatches) {
    throw new AppError(401, "Invalid email or password.", "invalid_credentials");
  }

  if (!user.is_active) {
    throw new AppError(403, "This account has been deactivated.", "account_disabled");
  }

  await userRepository.touchLastLogin(user.id);

  const session = await buildSessionUser(user.id);

  // employeeId rides in the token so `_self` scoping needs no extra lookup per request
  // (BR-RBAC-2). It is null for accounts with no employee record.
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role_name as RoleName,
    employeeId: session.employee?.id ?? null,
  };

  return {
    accessToken: signAccessToken(payload),
    expiresIn: expiresInSeconds(),
    user: session,
  };
}

export async function getSession(userId: string): Promise<SessionUser> {
  return buildSessionUser(userId);
}

export async function changePassword(userId: string, input: unknown): Promise<void> {
  const { currentPassword, newPassword } = parseOrThrow(changePasswordSchema, input);
  const currentHash = await userRepository.findPasswordHash(userId);

  if (!currentHash || !(await bcrypt.compare(currentPassword, currentHash))) {
    throw new AppError(401, "Current password is incorrect.", "invalid_credentials");
  }

  await userRepository.update(userId, {
    passwordHash: await bcrypt.hash(newPassword, SALT_ROUNDS),
  });
}

async function buildSessionUser(userId: string): Promise<SessionUser> {
  const user = await userRepository.findById(userId);

  if (!user) {
    throw new AppError(401, "Account no longer exists.", "unauthorized");
  }

  if (!user.is_active) {
    throw new AppError(403, "This account has been deactivated.", "account_disabled");
  }

  const permissions = await resolveCallerPermissions(user.role_name);

  return {
    user_id: user.id,
    email: user.email,
    role: user.role_name,
    role_label: user.role_label,
    permissions: [...permissions].sort(),
    employee: toEmployeeRef(user),
  };
}

/** `JWT_ACCESS_EXPIRES_IN` is a jsonwebtoken duration string ("15m", "1d", "3600"). */
function expiresInSeconds(): number {
  const raw = env.jwtAccessExpiresIn.trim();
  const match = /^(\d+)\s*([smhd])?$/.exec(raw);

  if (!match) {
    return 0;
  }

  const value = Number(match[1]);
  const unit = match[2] ?? "s";

  return value * { s: 1, m: 60, h: 3600, d: 86400 }[unit as "s" | "m" | "h" | "d"];
}
