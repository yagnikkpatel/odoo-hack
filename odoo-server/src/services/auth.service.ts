import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { AppError } from "../errors/AppError";
import {
  findAuthUserByEmail,
  updateUserPassword,
} from "../repositories/user.repository";
import { invalidateUserCache } from "./user.service";
import { signAccessToken } from "../lib/jwt";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import {
  ForgotPasswordInput,
  LoginInput,
  ResetPasswordInput,
  VerifyOtpInput,
} from "../types/user.dto";
import { UserRole } from "../types/user";

const SALT_ROUNDS = 12;

type LoginResult = {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: UserRole;
  };
};

type VerifyOtpResult = {
  resetToken: string;
  expiresInSeconds: number;
};

function otpKey(email: string): string {
  return `password-reset:otp:${email}`;
}

function resetTokenKey(token: string): string {
  return `password-reset:token:${token}`;
}

export async function login(input: LoginInput): Promise<LoginResult> {
  const user = await findAuthUserByEmail(input.email);

  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    user.password_hash,
  );

  if (!passwordMatches) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.status !== "active") {
    throw new AppError(403, "User account is inactive");
  }

  const accessToken = signAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  return {
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<void> {
  const user = await findAuthUserByEmail(input.email);

  if (!user) {
    logger.info(
      { email: input.email },
      "password reset requested for unknown email, no otp issued",
    );

    return;
  }

  await redis.set(
    otpKey(input.email),
    env.passwordResetOtp,
    "EX",
    env.passwordResetOtpTtlSeconds,
  );

  logger.info(
    {
      email: input.email,
      otp: env.passwordResetOtp,
      ttlSeconds: env.passwordResetOtpTtlSeconds,
    },
    "password reset otp issued",
  );
}

export async function verifyPasswordResetOtp(
  input: VerifyOtpInput,
): Promise<VerifyOtpResult> {
  const storedOtp = await redis.get(otpKey(input.email));

  if (!storedOtp || storedOtp !== input.otp) {
    logger.warn({ email: input.email }, "password reset otp rejected");

    throw new AppError(400, "Invalid or expired OTP");
  }

  const resetToken = randomBytes(32).toString("hex");

  await redis.set(
    resetTokenKey(resetToken),
    input.email,
    "EX",
    env.passwordResetTokenTtlSeconds,
  );

  await redis.del(otpKey(input.email));

  logger.info(
    { email: input.email, ttlSeconds: env.passwordResetTokenTtlSeconds },
    "password reset otp verified, reset token issued",
  );

  return {
    resetToken,
    expiresInSeconds: env.passwordResetTokenTtlSeconds,
  };
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const email = await redis.get(resetTokenKey(input.resetToken));

  if (!email) {
    logger.warn("password reset token rejected");

    throw new AppError(400, "Invalid or expired reset token");
  }

  const user = await findAuthUserByEmail(email);

  if (!user) {
    await redis.del(resetTokenKey(input.resetToken));

    throw new AppError(404, "User not found");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  const updatedId = await updateUserPassword(user.id, passwordHash);

  if (!updatedId) {
    throw new AppError(404, "User not found");
  }

  await redis.del(resetTokenKey(input.resetToken));
  await invalidateUserCache(user.id);

  logger.info({ email }, "password reset completed");
}
