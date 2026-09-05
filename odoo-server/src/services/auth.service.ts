import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { AppError } from "../errors/AppError";
import {
    findAuthUserByEmail,
    findUserById,
    updateUserPassword,
} from "../repositories/user.repository";
import { invalidateUserCache } from "./user.service";
import { signAccessToken, verifyRefreshToken } from "../lib/jwt";
import {
    issueRefreshToken,
    isRefreshSessionActive,
    revokeAllRefreshSessions,
    revokeRefreshSession,
} from "./refresh-session.service";
import { redis } from "../lib/redis";
import { logger } from "../lib/logger";
import { env } from "../config/env";
import {
    ForgotPasswordInput,
    LoginInput,
    RefreshTokenInput,
    ResetPasswordInput,
    VerifyOtpInput,
} from "../types/user.dto";
import { TokenPayload, UserRole } from "../types/user";

const SALT_ROUNDS = 12;

type LoginResult = {
    accessToken: string;
    refreshToken: string;
    refreshExpiresInSeconds: number;
    user: {
        id: string;
        email: string;
        role: UserRole;
    };
};

type RefreshResult = {
    accessToken: string;
    refreshToken: string;
    refreshExpiresInSeconds: number;
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

    const claims: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
    };

    const accessToken = signAccessToken(claims);
    const { refreshToken, expiresInSeconds } = await issueRefreshToken(claims);

    return {
        accessToken,
        refreshToken,
        refreshExpiresInSeconds: expiresInSeconds,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
        },
    };
}

export async function refreshSession(
    input: RefreshTokenInput,
): Promise<RefreshResult> {
    const payload = verifyRefreshToken(input.refreshToken);

    if (!(await isRefreshSessionActive(payload.userId, payload.sessionId))) {
        throw new AppError(401, "Refresh session is no longer valid");
    }

    // Re-read the account so a deactivated user or a changed role cannot keep
    // renewing access off stale token claims.
    const user = await findUserById(payload.userId);

    if (!user) {
        await revokeRefreshSession(payload.userId, payload.sessionId);

        throw new AppError(401, "User account no longer exists");
    }

    if (user.status !== "active") {
        await revokeAllRefreshSessions(user.id);

        throw new AppError(403, "User account is inactive");
    }

    const claims: TokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
    };

    // Rotate: issue a brand new session and retire the presented one, so a
    // leaked refresh token stops working as soon as it has been used once.
    // Each rotation extends the window, keeping active users signed in.
    const accessToken = signAccessToken(claims);
    const { refreshToken, expiresInSeconds } = await issueRefreshToken(claims);

    await revokeRefreshSession(payload.userId, payload.sessionId);

    logger.info({ userId: user.id }, "session refreshed");

    return {
        accessToken,
        refreshToken,
        refreshExpiresInSeconds: expiresInSeconds,
        user: {
            id: user.id,
            email: user.email,
            role: user.role,
        },
    };
}

export async function logout(input: RefreshTokenInput): Promise<void> {
    try {
        const payload = verifyRefreshToken(input.refreshToken);

        await revokeRefreshSession(payload.userId, payload.sessionId);

        logger.info({ userId: payload.userId }, "session revoked");
    } catch {
        // Logging out with an expired or unknown token is not an error: the
        // caller ends up signed out either way.
    }
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
    await revokeAllRefreshSessions(user.id);
    await invalidateUserCache(user.id);

    logger.info({ email }, "password reset completed");
}
