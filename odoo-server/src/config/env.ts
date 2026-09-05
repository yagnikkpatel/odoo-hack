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
  // Falls back to the access secret so existing deployments keep booting.
  // Refresh tokens stay distinguishable via their `type` claim and the
  // server-side session record, but a dedicated secret is preferred.
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
  // Payslip email delivery. Leave SMTP_HOST unset to log emails instead.
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  smtpFrom: process.env.SMTP_FROM ?? "PeoplePay360 Payroll <payroll@peoplepay360.local>",
} as const;
