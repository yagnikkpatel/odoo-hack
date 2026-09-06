import bcrypt from "bcryptjs";
import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
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
import { env, isSmtpConfigured } from "../config/env";
import { enqueuePasswordResetOtpEmail } from "../queues/authEmail.queue";
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

const OTP_DIGITS = 6;

function otpKey(email: string): string {
    return `password-reset:otp:${email}`;
}

function otpAttemptsKey(email: string): string {
    return `password-reset:otp-attempts:${email}`;
}

function otpResendKey(email: string): string {
    return `password-reset:otp-resend:${email}`;
}

function resetTokenKey(token: string): string {
    return `password-reset:token:${token}`;
}

function generateOtp(): string {
    // randomInt draws from the CSPRNG, so a code cannot be predicted from an
    // earlier one the way Math.random() output can.
    return String(randomInt(0, 10 ** OTP_DIGITS)).padStart(OTP_DIGITS, "0");
}

/**
 * Only the hash is stored: whoever reads Redis -- a dump, a shared cache, an
 * operator -- cannot turn what they see back into a usable code. Binding the
 * email into the digest stops a hash captured for one account from being
 * replayed against another.
 */
function hashOtp(email: string, otp: string): string {
    return createHash("sha256").update(`${email}:${otp}`).digest("hex");
}

function otpMatches(storedHash: string, email: string, otp: string): boolean {
    const candidate = Buffer.from(hashOtp(email, otp));
    const stored = Buffer.from(storedHash);

    if (stored.length !== candidate.length) {
        return false;
    }

    return timingSafeEqual(stored, candidate);
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
    if (!isSmtpConfigured) {
        logger.error("password reset requested but SMTP is not configured");

        throw new AppError(
            503,
            "Password reset email is not configured. Contact your administrator.",
        );
    }

    // Claimed before the account is looked up, so a repeat request answers the
    // same way whether or not the address is registered -- a cooldown that only
    // registered addresses could trigger would answer the question this
    // endpoint deliberately refuses to. NX makes the claim atomic, so two
    // concurrent requests cannot both win it and a held-down resend button
    // costs one email rather than several.
    if (env.passwordResetResendCooldownSeconds > 0) {
        const claimed = await redis.set(
            otpResendKey(input.email),
            "1",
            "EX",
            env.passwordResetResendCooldownSeconds,
            "NX",
        );

        if (claimed === null) {
            const retryAfter = await redis.ttl(otpResendKey(input.email));

            throw new AppError(
                429,
                `An OTP was just sent. Try again in ${Math.max(retryAfter, 1)} seconds.`,
            );
        }
    }

    const user = await findAuthUserByEmail(input.email);

    if (!user) {
        logger.info(
            { email: input.email },
            "password reset requested for unknown email, no otp issued",
        );

        return;
    }

    const otp = generateOtp();

    // Issuing replaces any code still outstanding and clears its attempt count,
    // so the newest email is the only one that works and arrives with a full
    // budget of tries.
    await redis.set(
        otpKey(input.email),
        hashOtp(input.email, otp),
        "EX",
        env.passwordResetOtpTtlSeconds,
    );
    await redis.del(otpAttemptsKey(input.email));

    try {
        await enqueuePasswordResetOtpEmail({
            to: user.email,
            name: user.name,
            otp,
            expiresInSeconds: env.passwordResetOtpTtlSeconds,
        });
    } catch (error) {
        // Nothing was mailed, so leave no code behind that the user has no way
        // of learning, and release the cooldown so they can retry immediately.
        await redis.del(otpKey(input.email), otpResendKey(input.email));

        logger.error(
            { err: error, email: input.email },
            "failed to queue password reset otp email",
        );

        throw new AppError(
            503,
            "We could not send the OTP email right now. Please try again shortly.",
        );
    }

    logger.info(
        {
            email: input.email,
            ttlSeconds: env.passwordResetOtpTtlSeconds,
        },
        "password reset otp issued",
    );
}

export async function verifyPasswordResetOtp(
    input: VerifyOtpInput,
): Promise<VerifyOtpResult> {
    const storedHash = await redis.get(otpKey(input.email));

    if (!storedHash) {
        logger.warn({ email: input.email }, "password reset otp rejected");

        throw new AppError(400, "Invalid or expired OTP");
    }

    // Count the guess before checking it, so a crash or a race cannot hand back
    // a free attempt. The counter shares the OTP's lifetime; a fresh code
    // clears it.
    const attempts = await redis.incr(otpAttemptsKey(input.email));

    if (attempts === 1) {
        await redis.expire(
            otpAttemptsKey(input.email),
            env.passwordResetOtpTtlSeconds,
        );
    }

    if (attempts > env.passwordResetOtpMaxAttempts) {
        await redis.del(otpKey(input.email), otpAttemptsKey(input.email));

        logger.warn(
            { email: input.email, attempts },
            "password reset otp discarded after too many attempts",
        );

        throw new AppError(
            429,
            "Too many incorrect attempts. Request a new OTP.",
        );
    }

    if (!otpMatches(storedHash, input.email, input.otp)) {
        logger.warn({ email: input.email, attempts }, "password reset otp rejected");

        throw new AppError(400, "Invalid or expired OTP");
    }

    const resetToken = randomBytes(32).toString("hex");

    await redis.set(
        resetTokenKey(resetToken),
        input.email,
        "EX",
        env.passwordResetTokenTtlSeconds,
    );

    await redis.del(
        otpKey(input.email),
        otpAttemptsKey(input.email),
        otpResendKey(input.email),
    );

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
