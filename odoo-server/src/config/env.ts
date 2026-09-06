import dotenv from "dotenv";

dotenv.config();

function checkRequiredEnvVariables(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing env variables for ${key}`);
  }

  return value;
}

function boundedNumber(key: string, fallback: number, min: number, max: number): number {
  const raw = process.env[key];
  const value = raw === undefined || raw.trim() === "" ? fallback : Number(raw);
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${key} must be a finite number between ${min} and ${max}`);
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
  // Password reset OTPs are generated per request and mailed over SMTP; there is
  // no fixed code to configure.
  passwordResetOtpTtlSeconds: boundedNumber("PASSWORD_RESET_OTP_TTL_SECONDS", 600, 60, 3600),
  passwordResetTokenTtlSeconds: boundedNumber("PASSWORD_RESET_TOKEN_TTL_SECONDS", 600, 60, 3600),
  // A wrong code burns one of these; the OTP is discarded once they run out, so
  // guessing costs a new email rather than more tries.
  passwordResetOtpMaxAttempts: boundedNumber("PASSWORD_RESET_OTP_MAX_ATTEMPTS", 5, 1, 20),
  passwordResetResendCooldownSeconds: boundedNumber("PASSWORD_RESET_RESEND_COOLDOWN_SECONDS", 60, 0, 3600),
  // Optional payroll delivery settings; normal payroll works without SMTP.
  smtpHost: process.env.SMTP_HOST ?? "",
  smtpPort: Number(process.env.SMTP_PORT ?? 587),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpUser: process.env.SMTP_USER ?? "",
  smtpPassword: process.env.SMTP_PASSWORD ?? "",
  smtpFromName: process.env.SMTP_FROM_NAME ?? "PeoplePay360 Payroll",
  smtpFromEmail: process.env.SMTP_FROM_EMAIL ?? process.env.SMTP_USER ?? "",
  smtpMaxConnections: boundedNumber("SMTP_MAX_CONNECTIONS", 3, 1, 20),
  smtpMessagesPerSecond: boundedNumber("SMTP_MESSAGES_PER_SECOND", 5, 1, 100),
  // Preserve the recovered verification threshold and GPS allowance defaults.
  // Tighten GPS policy explicitly for a deployment after testing its devices.
  faceMatchThreshold: boundedNumber("FACE_MATCH_THRESHOLD", 0.5, 0.1, 1),
  locationAccuracyAllowanceM: boundedNumber("ATTENDANCE_LOCATION_ACCURACY_ALLOWANCE_M", 100, 0, 1000),
  locationMaxAccuracyM: boundedNumber("ATTENDANCE_LOCATION_MAX_ACCURACY_M", 1000, 1, 10000),
  attendanceStoreSelfies: process.env.ATTENDANCE_STORE_SELFIES !== "false",
} as const;

export const isSmtpConfigured = Boolean(env.smtpHost && env.smtpUser && env.smtpPassword && env.smtpFromEmail);
