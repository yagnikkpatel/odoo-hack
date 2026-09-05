import dotenv from "dotenv";

dotenv.config();

function checkRequiredEnvVariables(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing env variables for ${key}`);
  }

  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  isProduction: (process.env.NODE_ENV ?? "development") === "production",
  nodeEnv: process.env.NODE_ENV ?? "development",
  logLevel: process.env.LOG_LEVEL ?? "info",
  databaseUrl: checkRequiredEnvVariables("DATABASE_URL"),
  jwtAccessSecret: checkRequiredEnvVariables("JWT_SECRET"),
  jwtAccessExpiresIn: checkRequiredEnvVariables("JWT_ACCESS_EXPIRES_IN"),
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET ?? checkRequiredEnvVariables("JWT_SECRET"),
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  redisUrl: checkRequiredEnvVariables("REDIS_URL"),
  cacheTtlSeconds: Number(process.env.CACHE_TTL_SECONDS ?? 60),
  passwordResetOtp: process.env.PASSWORD_RESET_OTP ?? "123456",
  passwordResetOtpTtlSeconds: Number(
    process.env.PASSWORD_RESET_OTP_TTL_SECONDS ?? 600,
  ),
  passwordResetTokenTtlSeconds: Number(
    process.env.PASSWORD_RESET_TOKEN_TTL_SECONDS ?? 600,
  ),
} as const;
